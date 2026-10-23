import { Router } from 'express';
import { auth, getSettings, need } from '../auth';
import { loadModel } from '../cost';
import { q } from '../db';
import { methodLabel, payBetween, revenueByCategory, revenueByDay, soldProducts, sumDays } from '../reports';
import { addDays, ah, daysBetween, HttpError, isoDate, n, parse, periodOf, round2 } from '../util';

/** Расширенные отчёты: загрузка по часам и дням недели, сравнение периодов, способы оплаты. */
export const router = Router();
router.use('/rep', auth);

/* ───────── Загрузка по часам и дням недели ───────── */
router.get('/rep/heatmap', need('rep.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const basis = req.query.basis === 'paid' ? 'paid' : 'created';
  const col = basis === 'paid' ? 'p."actualizadoEn"' : 'p."creadoEn"';
  const rows = await q(
    `select extract(isodow from (${col} at time zone 'UTC' at time zone $2))::int as dow, extract(hour from (${col} at time zone 'UTC' at time zone $2))::int as hr,
            count(*)::int as orders, coalesce(sum(p.total), 0) as revenue
       from public."Pedido" p where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()} group by 1, 2`, [rid, s.timezone, from, to]);
  const cells = rows.map((r) => ({ dow: r.dow as number, hour: r.hr as number, orders: r.orders as number, revenue: round2(n(r.revenue)) }));
  // сколько раз каждый день недели встретился в периоде — чтобы показать «в среднем за такой день»
  const occ = [0, 0, 0, 0, 0, 0, 0];
  for (let d = from; d <= to; d = addDays(d, 1)) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); occ[w === 0 ? 6 : w - 1]++; }
  const byDow = [1, 2, 3, 4, 5, 6, 7].map((d) => { const c = cells.filter((x) => x.dow === d); const revenue = round2(c.reduce((a, x) => a + x.revenue, 0)); const orders = c.reduce((a, x) => a + x.orders, 0); return { dow: d, revenue, orders, days: occ[d - 1], avgRevenue: occ[d - 1] ? round2(revenue / occ[d - 1]) : 0 }; });
  const byHour = Array.from({ length: 24 }, (_, h) => { const c = cells.filter((x) => x.hour === h); return { hour: h, revenue: round2(c.reduce((a, x) => a + x.revenue, 0)), orders: c.reduce((a, x) => a + x.orders, 0) }; });
  const best = [...cells].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  res.json({ from, to, basis, cells, byDow, byHour, best, total: { revenue: round2(cells.reduce((a, x) => a + x.revenue, 0)), orders: cells.reduce((a, x) => a + x.orders, 0) } });
}));

/* ───────── Сравнение периодов ───────── */
async function block(rid: string, tz: string, from: string, to: string) {
  const [days, sold, cats, canc, model] = await Promise.all([
    revenueByDay(rid, tz, from, to), soldProducts(rid, tz, from, to), revenueByCategory(rid, tz, from, to),
    q(`select count(*)::int as c from public."Pedido" p where p."restauranteId" = $1 and p.estado = 'CANCELADO' and ${payBetween()}`, [rid, tz, from, to]),
    loadModel(rid),
  ]);
  const t = sumDays(days);
  return {
    from, to, days: daysBetween(from, to) + 1, revenue: round2(t.revenue), orders: t.orders, avgCheck: t.orders ? round2(t.revenue / t.orders) : 0, items: sold.reduce((a, x) => a + x.qty, 0), cancelled: canc[0]?.c ?? 0,
    methods: [['Наличные', t.cash], ['Карта', t.card], ['QR', t.qr], ['Перевод', t.transfer], [methodLabel(null), t.other]].map(([name, value]) => ({ name: name as string, value: round2(value as number) })).filter((m) => m.value > 0),
    categories: cats.map((c) => ({ id: c.id, name: c.nombre, revenue: round2(c.revenue), qty: c.qty })),
    products: sold.map((x) => ({ id: x.id, name: model.productos.get(x.id)?.nombre ?? '—', qty: x.qty, revenue: round2(x.revenue) })),
  };
}

router.get('/rep/compare', need('rep.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const { from, to } = periodOf(req, tz);
  let bFrom: string, bTo: string;
  if (typeof req.query.bFrom === 'string' && typeof req.query.bTo === 'string') {
    bFrom = parse(isoDate, req.query.bFrom); bTo = parse(isoDate, req.query.bTo);
    if (bFrom > bTo) throw new HttpError(400, 'Начало сравниваемого периода позже конца');
  } else if (req.query.mode === 'year') {
    const shift = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
    bFrom = shift(from); bTo = shift(to);
  } else { const len = daysBetween(from, to) + 1; bTo = addDays(from, -1); bFrom = addDays(from, -len); }
  const [a, b] = await Promise.all([block(rid, tz, from, to), block(rid, tz, bFrom, bTo)]);
  const pct = (x: number, y: number) => (y ? round2(((x - y) / y) * 100) : null);
  const bProd = new Map(b.products.map((p) => [p.id, p]));
  const prodRows = new Map<string, { id: string; name: string; qtyA: number; qtyB: number; revA: number; revB: number }>();
  for (const p of a.products) prodRows.set(p.id, { id: p.id, name: p.name, qtyA: p.qty, qtyB: bProd.get(p.id)?.qty ?? 0, revA: p.revenue, revB: bProd.get(p.id)?.revenue ?? 0 });
  for (const p of b.products) if (!prodRows.has(p.id)) prodRows.set(p.id, { id: p.id, name: p.name, qtyA: 0, qtyB: p.qty, revA: 0, revB: p.revenue });
  const products = [...prodRows.values()].map((r) => ({ ...r, delta: round2(r.revA - r.revB), pct: pct(r.revA, r.revB) })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 40);
  const bCat = new Map(b.categories.map((c) => [c.id, c]));
  const cats = [...new Set([...a.categories.map((c) => c.id), ...b.categories.map((c) => c.id)])].map((id) => { const x = a.categories.find((c) => c.id === id), y = bCat.get(id); return { id, name: (x ?? y)!.name, revA: x?.revenue ?? 0, revB: y?.revenue ?? 0, delta: round2((x?.revenue ?? 0) - (y?.revenue ?? 0)), pct: pct(x?.revenue ?? 0, y?.revenue ?? 0) }; }).sort((x, y) => y.revA - x.revA);
  res.json({
    a: { from: a.from, to: a.to, days: a.days }, b: { from: b.from, to: b.to, days: b.days },
    metrics: ['revenue', 'orders', 'avgCheck', 'items', 'cancelled'].map((k) => ({ key: k, a: (a as any)[k] as number, b: (b as any)[k] as number, pct: pct((a as any)[k], (b as any)[k]) })),
    perDay: { a: a.days ? round2(a.revenue / a.days) : 0, b: b.days ? round2(b.revenue / b.days) : 0 },
    methods: [...new Set([...a.methods.map((m) => m.name), ...b.methods.map((m) => m.name)])].map((name) => ({ name, a: a.methods.find((m) => m.name === name)?.value ?? 0, b: b.methods.find((m) => m.name === name)?.value ?? 0 })),
    categories: cats, products,
  });
}));

/* ───────── Способы оплаты ───────── */
router.get('/rep/payments', need('rep.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const { from, to } = periodOf(req, tz);
  const [days, by] = await Promise.all([
    revenueByDay(rid, tz, from, to),
    q(`select coalesce(p."metodoPago", '—') as method, count(*)::int as orders, coalesce(sum(p.total), 0) as revenue from public."Pedido" p where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween('$3', '$4')} group by 1 order by 3 desc`, [rid, tz, from, to]),
  ]);
  const total = round2(by.reduce((a, r) => a + n(r.revenue), 0));
  res.json({
    from, to, total,
    methods: by.map((r) => ({ method: r.method === '—' ? 'Не указан' : methodLabel(r.method), orders: r.orders, revenue: round2(n(r.revenue)), share: total ? round2((n(r.revenue) / total) * 100) : 0, avgCheck: r.orders ? round2(n(r.revenue) / r.orders) : 0 })),
    daily: days.map((d) => ({ date: d.date, cash: d.cash, card: d.card, qr: d.qr, transfer: d.transfer, other: d.other, total: d.revenue })),
  });
}));
