import { Router } from 'express';
import { auth, getSettings, hasPerm, need } from '../auth';
import { q } from '../db';
import { loadModel } from '../cost';
import { cogs, methodLabel, revenueByDay, revenueByOutlet, soldProducts, sumDays, revenueByCategory } from '../reports';
import { addDays, ah, daysBetween, n, periodOf, round2 } from '../util';

export const router = Router();

/** Главная страница: показатели зависят от прав пользователя (бухгалтерия, фудкорт, техкарты). */
router.get('/dashboard', auth, need('dashboard'), ah(async (req, res) => {
  const me = req.me!;
  const s = await getSettings(me.rid);
  const { from, to } = periodOf(req, s.timezone);
  const len = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -len);
  const out: Record<string, unknown> = { from, to, role: me.role };

  const canMoney = hasPerm(me, 'acc.view');
  const canFc = hasPerm(me, 'fc.view');
  const canTc = hasPerm(me, 'tc.view');

  if (canMoney || canFc) {
    const [days, prevDays] = await Promise.all([revenueByDay(me.rid, s.timezone, from, to), revenueByDay(me.rid, s.timezone, prevFrom, prevTo)]);
    const t = sumDays(days), pt = sumDays(prevDays);
    // ряд по дням без пропусков
    const map = new Map(days.map((d) => [d.date, d]));
    const series: { date: string; revenue: number; orders: number }[] = [];
    for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i++) series.push({ date: d, revenue: map.get(d)?.revenue ?? 0, orders: map.get(d)?.orders ?? 0 });
    out.revenue = {
      total: round2(t.revenue), orders: t.orders, avgCheck: t.orders ? round2(t.revenue / t.orders) : 0, prevTotal: round2(pt.revenue), prevOrders: pt.orders,
      methods: [['Наличные', t.cash], ['Карта', t.card], ['QR', t.qr], ['Перевод', t.transfer], [methodLabel(null), t.other]].filter(([, v]) => (v as number) > 0).map(([name, value]) => ({ name, value: round2(value as number) })),
      series,
    };
    const [cats, sold, model] = await Promise.all([revenueByCategory(me.rid, s.timezone, from, to), soldProducts(me.rid, s.timezone, from, to), loadModel(me.rid)]);
    out.categories = cats.slice(0, 8);
    out.topProducts = sold.map((x) => ({ nombre: model.productos.get(x.id)?.nombre ?? '—', qty: x.qty, revenue: round2(x.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }

  if (canMoney) {
    const [exp, cg, debt] = await Promise.all([
      q('select coalesce(sum(amount), 0) as total from office.expense where restaurante_id = $1 and date between $2::date and $3::date', [me.rid, from, to]),
      cogs(me.rid, s.timezone, from, to),
      q(`select coalesce(sum(greatest(0, rec - paid)), 0) as debt from (
           select coalesce((select sum(ri.cantidad * ri."costoUnitario") from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" where rc."compraId" = c.id), 0) as rec,
                  coalesce((select sum(pp.amount) from office.purchase_payment pp where pp.compra_id = c.id), 0) as paid
             from public."Compra" c where c."restauranteId" = $1 and c.estado <> 'CANCELADA') x`, [me.rid]),
    ]);
    const rev = (out.revenue as { total: number }).total;
    const vat = s.vatEnabled ? round2(rev * s.vat / (100 + s.vat)) : 0;
    const gp = round2(rev - vat - cg.total);
    out.finance = { expenses: round2(n(exp[0].total)), cogs: cg.total, vat, grossProfit: gp, profit: round2(gp - n(exp[0].total)), debt: round2(n(debt[0].debt)), noCard: cg.noCard };
  }

  if (canFc) {
    const [outlets, rev] = await Promise.all([q('select id, name, status from office.outlet where restaurante_id = $1', [me.rid]), revenueByOutlet(me.rid, s.timezone, from, to)]);
    const names = new Map(outlets.map((o) => [o.id, o.name as string]));
    const rows = rev.filter((r) => r.outletId).map((r) => ({ name: names.get(r.outletId!) ?? '—', revenue: round2(r.revenue), orders: r.orders })).sort((a, b) => b.revenue - a.revenue);
    const un = rev.find((r) => !r.outletId);
    out.outlets = { count: outlets.length, active: outlets.filter((o) => o.status === 'active').length, rows: rows.slice(0, 8), unassigned: un ? round2(un.revenue) : 0 };
    const open = await q(`select count(*) filter (where status = 'draft')::int as draft, count(*) filter (where status = 'issued')::int as issued, coalesce(sum(payable) filter (where status = 'issued'), 0) as to_pay from office.settlement where restaurante_id = $1`, [me.rid]);
    out.settlements = { draft: open[0].draft, issued: open[0].issued, toPay: round2(n(open[0].to_pay)) };
  }

  if (canTc) {
    const model = await loadModel(me.rid);
    const st = await q('select status, count(*)::int as c from office.tc_state where restaurante_id = $1 group by 1', [me.rid]);
    const by: Record<string, number> = { draft: 0, review: 0, approved: 0, rejected: 0 };
    for (const r of st) by[r.status] = r.c;
    let withoutCard = 0, incomplete = 0, lowMargin = 0;
    for (const p of model.productos.values()) {
      const c = model.costOf(p.id);
      if (!c.hasCard) { withoutCard += 1; continue; }
      if (c.incompleto) incomplete += 1;
      if (p.precio > 0 && 1 - c.costo / p.precio < 0.5) lowMargin += 1;
    }
    out.techcards = { total: model.productos.size, withoutCard, incomplete, lowMargin, ...by };
  }
  res.json(out);
}));
