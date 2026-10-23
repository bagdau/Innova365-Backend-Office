import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1, tx } from '../db';
import { payBetween, revenueByOutlet } from '../reports';
import { ah, HttpError, isoDate, n, parse, periodOf, round2, todayIso } from '../util';
import { loadRentHistory, rentFor, setRent } from '../rent';

export const router = Router();
router.use('/fc', auth);

const pct = z.number().min(0, 'Процент от 0 до 100').max(100, 'Процент от 0 до 100');
const outletBody = z.object({
  name: z.string().trim().min(1, 'Укажите название точки').max(80),
  legalName: z.string().trim().max(160).nullish(), bin: z.string().trim().max(20).nullish(),
  contact: z.string().trim().max(80).nullish(), phone: z.string().trim().max(40).nullish(), email: z.string().trim().max(120).nullish(),
  rentMonthly: z.number().min(0).max(1e10).default(0), commissionPct: pct.default(0),
  status: z.enum(['active', 'paused', 'closed']).default('active'),
  startDate: isoDate.nullish(), endDate: isoDate.nullish(), notes: z.string().trim().max(1000).nullish(), rentEffectiveFrom: isoDate.nullish(),
});

const outletOut = (o: any) => ({
  id: o.id, name: o.name, legalName: o.legal_name, bin: o.bin, contact: o.contact, phone: o.phone, email: o.email,
  rentMonthly: n(o.rent_monthly), commissionPct: n(o.commission_pct), status: o.status, startDate: o.start_date, endDate: o.end_date, notes: o.notes,
});

/* ───────── Точки ───────── */
router.get('/fc/outlets', need('fc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const [outlets, maps, cats] = await Promise.all([
    q('select * from office.outlet where restaurante_id = $1 order by lower(name)', [rid]),
    q('select categoria_id, outlet_id from office.outlet_category where restaurante_id = $1', [rid]),
    q(`select c.id, c.nombre, (select count(*)::int from public."Producto" p where p."categoriaId" = c.id) as products from public."Categoria" c where c."restauranteId" = $1 order by c.nombre`, [rid]),
  ]);
  const byOutlet = new Map<string, string[]>();
  for (const m of maps) (byOutlet.get(m.outlet_id) ?? byOutlet.set(m.outlet_id, []).get(m.outlet_id)!).push(m.categoria_id);
  res.json({
    outlets: outlets.map((o) => ({ ...outletOut(o), categoryIds: byOutlet.get(o.id) ?? [] })),
    categories: cats.map((c) => ({ id: c.id, nombre: c.nombre, products: c.products, outletId: maps.find((m) => m.categoria_id === c.id)?.outlet_id ?? null })),
  });
}));

router.post('/fc/outlets', need('fc.edit'), ah(async (req, res) => {
  const b = parse(outletBody, req.body);
  if (b.startDate && b.endDate && b.endDate < b.startDate) throw new HttpError(400, 'Дата окончания раньше даты начала');
  const dup = await q1('select 1 from office.outlet where restaurante_id = $1 and lower(name) = lower($2)', [req.me!.rid, b.name]);
  if (dup) throw new HttpError(409, 'Точка с таким названием уже есть');
  const o = await q1(`insert into office.outlet (restaurante_id, name, legal_name, bin, contact, phone, email, rent_monthly, commission_pct, status, start_date, end_date, notes)
                      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [req.me!.rid, b.name, b.legalName ?? null, b.bin ?? null, b.contact ?? null, b.phone ?? null, b.email ?? null, b.rentMonthly, b.commissionPct, b.status, b.startDate ?? null, b.endDate ?? null, b.notes ?? null]);
  await audit(req, 'outlet.create', 'outlet', o!.id, { name: b.name });
  res.status(201).json(outletOut(o));
}));

router.put('/fc/outlets/:id', need('fc.edit'), ah(async (req, res) => {
  const b = parse(outletBody, req.body);
  if (b.startDate && b.endDate && b.endDate < b.startDate) throw new HttpError(400, 'Дата окончания раньше даты начала');
  const dup = await q1('select 1 from office.outlet where restaurante_id = $1 and lower(name) = lower($2) and id <> $3', [req.me!.rid, b.name, req.params.id]);
  if (dup) throw new HttpError(409, 'Точка с таким названием уже есть');
  const before = await q1<{ rent_monthly: string }>('select rent_monthly from office.outlet where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  const o = await q1(`update office.outlet set name=$3, legal_name=$4, bin=$5, contact=$6, phone=$7, email=$8, rent_monthly=$9, commission_pct=$10, status=$11, start_date=$12, end_date=$13, notes=$14
                      where id = $1 and restaurante_id = $2 returning *`,
    [req.params.id, req.me!.rid, b.name, b.legalName ?? null, b.bin ?? null, b.contact ?? null, b.phone ?? null, b.email ?? null, b.rentMonthly, b.commissionPct, b.status, b.startDate ?? null, b.endDate ?? null, b.notes ?? null]);
  if (!o) throw new HttpError(404, 'Точка не найдена');
  if (before && Math.abs(n(before.rent_monthly) - b.rentMonthly) >= 0.005) {
    const tz = (await getSettings(req.me!.rid)).timezone;
    await setRent(req.me!.rid, o.id, n(before.rent_monthly), b.rentMonthly, b.rentEffectiveFrom ?? todayIso(tz), 'Изменение в карточке точки', req.me!.name);
  }
  await audit(req, 'outlet.update', 'outlet', o.id, { name: b.name });
  res.json(outletOut({ ...o, rent_monthly: b.rentMonthly }));
}));

router.delete('/fc/outlets/:id', need('fc.edit'), ah(async (req, res) => {
  const used = await q1('select 1 from office.settlement where outlet_id = $1 limit 1', [req.params.id]);
  if (used) throw new HttpError(409, 'По точке есть взаиморасчёты — удалить нельзя. Переведите её в статус «Закрыта».');
  const r = await q('delete from office.outlet where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Точка не найдена');
  await audit(req, 'outlet.delete', 'outlet', req.params.id);
  res.json({ ok: true });
}));

/** Закрепление категорий меню за точкой: выручка по этим категориям идёт в расчёт точки. Категории переносятся от прежней точки. */
router.put('/fc/outlets/:id/categories', need('fc.edit'), ah(async (req, res) => {
  const b = parse(z.object({ categoryIds: z.array(z.string().min(1)).max(200) }), req.body);
  const rid = req.me!.rid;
  const o = await q1('select id from office.outlet where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!o) throw new HttpError(404, 'Точка не найдена');
  const ok = await q('select id from public."Categoria" where "restauranteId" = $1 and id = any($2::text[])', [rid, b.categoryIds]);
  if (ok.length !== new Set(b.categoryIds).size) throw new HttpError(400, 'Некорректная категория');
  await tx(async (c) => {
    await c.query('delete from office.outlet_category where outlet_id = $1', [req.params.id]);
    for (const id of b.categoryIds) {
      await c.query(`insert into office.outlet_category (restaurante_id, categoria_id, outlet_id) values ($1,$2,$3)
                     on conflict (restaurante_id, categoria_id) do update set outlet_id = excluded.outlet_id`, [rid, id, req.params.id]);
    }
  });
  await audit(req, 'outlet.categories', 'outlet', req.params.id, { categoryIds: b.categoryIds });
  res.json({ ok: true });
}));

/* ───────── Выручка по точкам ───────── */
async function outletRevenue(rid: string, from: string, to: string) {
  const tz = (await getSettings(rid)).timezone;
  const [outlets, rev, hist] = await Promise.all([q('select * from office.outlet where restaurante_id = $1 order by lower(name)', [rid]), revenueByOutlet(rid, tz, from, to), loadRentHistory(rid)]);
  const byId = new Map(rev.map((r) => [r.outletId, r]));
  const rows = outlets.map((o) => {
    const r = byId.get(o.id) ?? { orders: 0, qty: 0, revenue: 0 };
    const commission = round2(r.revenue * n(o.commission_pct) / 100);
    const rent = rentFor(o, hist.get(o.id), from, to);
    return { outletId: o.id as string, name: o.name as string, status: o.status as string, commissionPct: n(o.commission_pct), orders: r.orders, qty: r.qty, revenue: round2(r.revenue), commission, rent, payable: round2(r.revenue - commission - rent) };
  });
  const un = byId.get(null);
  return { rows, unassigned: un ? { orders: un.orders, qty: un.qty, revenue: round2(un.revenue) } : { orders: 0, qty: 0, revenue: 0 } };
}

router.get('/fc/revenue', need('fc.view'), ah(async (req, res) => {
  const tz = (await getSettings(req.me!.rid)).timezone;
  const { from, to } = periodOf(req, tz);
  const r = await outletRevenue(req.me!.rid, from, to);
  const total = r.rows.reduce((a, x) => ({ revenue: a.revenue + x.revenue, commission: a.commission + x.commission, rent: a.rent + x.rent, payable: a.payable + x.payable }), { revenue: 0, commission: 0, rent: 0, payable: 0 });
  res.json({ from, to, ...r, total: { revenue: round2(total.revenue + r.unassigned.revenue), assigned: round2(total.revenue), commission: round2(total.commission), rent: round2(total.rent), payable: round2(total.payable) } });
}));

/* ───────── Взаиморасчёты ───────── */
const stOut = (s: any) => ({
  id: s.id, number: s.number, outletId: s.outlet_id, outletName: s.outlet_name, periodFrom: s.period_from, periodTo: s.period_to, orders: s.orders,
  revenue: n(s.revenue), commissionPct: n(s.commission_pct), commission: n(s.commission), rent: n(s.rent), payable: n(s.payable),
  status: s.status, issuedAt: s.issued_at, paidAt: s.paid_at, paidMethod: s.paid_method, notes: s.notes, createdAt: s.created_at,
});

router.get('/fc/settlements', need('fc.view'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' && ['draft', 'issued', 'paid'].includes(req.query.status) ? req.query.status : null;
  const outletId = typeof req.query.outletId === 'string' && req.query.outletId ? req.query.outletId : null;
  const rows = await q(
    `select s.*, o.name as outlet_name from office.settlement s join office.outlet o on o.id = s.outlet_id
      where s.restaurante_id = $1 and ($2::text is null or s.status = $2) and ($3::text is null or s.outlet_id = $3)
      order by s.period_from desc, s.number desc limit 500`, [req.me!.rid, status, outletId]);
  res.json(rows.map(stOut));
}));

async function computeSettlement(rid: string, outletId: string, from: string, to: string) {
  const o = await q1('select * from office.outlet where id = $1 and restaurante_id = $2', [outletId, rid]);
  if (!o) throw new HttpError(404, 'Точка не найдена');
  const tz = (await getSettings(rid)).timezone;
  const rev = (await revenueByOutlet(rid, tz, from, to)).find((r) => r.outletId === outletId) ?? { orders: 0, revenue: 0 };
  const revenue = round2(rev.revenue);
  const commission = round2(revenue * n(o.commission_pct) / 100);
  const rent = rentFor(o, (await loadRentHistory(rid)).get(o.id), from, to);
  return { outlet: o, orders: rev.orders, revenue, commissionPct: n(o.commission_pct), commission, rent, payable: round2(revenue - commission - rent) };
}

router.post('/fc/settlements/generate', need('fc.settle'), ah(async (req, res) => {
  const b = parse(z.object({ outletId: z.string().min(1), from: isoDate, to: isoDate }), req.body);
  if (b.from > b.to) throw new HttpError(400, 'Начало периода позже конца');
  const rid = req.me!.rid;
  const overlap = await q1(`select number from office.settlement where outlet_id = $1 and restaurante_id = $2 and period_from <= $4::date and period_to >= $3::date limit 1`, [b.outletId, rid, b.from, b.to]);
  if (overlap) throw new HttpError(409, `Период пересекается с расчётом №${overlap.number}`);
  const c = await computeSettlement(rid, b.outletId, b.from, b.to);
  const s = await q1(`insert into office.settlement (restaurante_id, outlet_id, period_from, period_to, orders, revenue, commission_pct, commission, rent, payable, created_by)
                      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`, [rid, b.outletId, b.from, b.to, c.orders, c.revenue, c.commissionPct, c.commission, c.rent, c.payable, req.me!.name]);
  await audit(req, 'settlement.create', 'settlement', s!.id, { outlet: c.outlet.name, from: b.from, to: b.to, revenue: c.revenue });
  res.status(201).json({ id: s!.id });
}));

router.get('/fc/settlements/:id', need('fc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await q1(`select s.*, o.name as outlet_name, o.legal_name, o.bin, o.contact, o.phone, o.email from office.settlement s join office.outlet o on o.id = s.outlet_id where s.id = $1 and s.restaurante_id = $2`, [req.params.id, rid]);
  if (!s) throw new HttpError(404, 'Расчёт не найден');
  const tz = (await getSettings(rid)).timezone;
  const lines = await q(
    `select c.nombre, sum(ip.cantidad)::int as qty, sum(ip.subtotal) as revenue
       from public."ItemPedido" ip join public."Pedido" p on p.id = ip."pedidoId"
       join public."Producto" pr on pr.id = ip."productoId" join public."Categoria" c on c.id = pr."categoriaId"
       join office.outlet_category oc on oc.categoria_id = c.id and oc.restaurante_id = p."restauranteId" and oc.outlet_id = $5
      where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()}
      group by c.nombre order by 3 desc`, [rid, tz, s.period_from, s.period_to, s.outlet_id]);
  res.json({ ...stOut(s), outlet: { name: s.outlet_name, legalName: s.legal_name, bin: s.bin, contact: s.contact, phone: s.phone, email: s.email }, lines: lines.map((l) => ({ nombre: l.nombre, qty: l.qty, revenue: n(l.revenue) })) });
}));

/** Пересчитать черновик по актуальным данным. */
router.post('/fc/settlements/:id/recalc', need('fc.settle'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await q1('select * from office.settlement where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!s) throw new HttpError(404, 'Расчёт не найден');
  if (s.status !== 'draft') throw new HttpError(409, 'Пересчитать можно только черновик');
  const c = await computeSettlement(rid, s.outlet_id, s.period_from, s.period_to);
  await q('update office.settlement set orders=$2, revenue=$3, commission_pct=$4, commission=$5, rent=$6, payable=$7 where id = $1', [s.id, c.orders, c.revenue, c.commissionPct, c.commission, c.rent, c.payable]);
  await audit(req, 'settlement.recalc', 'settlement', s.id);
  res.json({ ok: true });
}));

router.patch('/fc/settlements/:id', need('fc.settle'), ah(async (req, res) => {
  const b = parse(z.object({ status: z.enum(['issued', 'paid']).optional(), paidMethod: z.string().trim().max(40).nullish(), notes: z.string().trim().max(500).nullish() }), req.body);
  const rid = req.me!.rid;
  const s = await q1('select * from office.settlement where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!s) throw new HttpError(404, 'Расчёт не найден');
  if (b.status === 'issued' && s.status !== 'draft') throw new HttpError(409, 'Выставить можно только черновик');
  if (b.status === 'paid' && s.status === 'paid') throw new HttpError(409, 'Расчёт уже оплачен');
  if (b.status === 'paid' && s.status === 'draft') throw new HttpError(409, 'Сначала выставьте расчёт');
  await q(`update office.settlement set status = coalesce($2, status),
             issued_at = case when $2 = 'issued' then now() else issued_at end,
             paid_at = case when $2 = 'paid' then now() else paid_at end,
             paid_method = coalesce($3, paid_method), notes = coalesce($4, notes) where id = $1`, [s.id, b.status ?? null, b.paidMethod ?? null, b.notes ?? null]);
  await audit(req, 'settlement.' + (b.status ?? 'update'), 'settlement', s.id, b);
  res.json({ ok: true });
}));

router.delete('/fc/settlements/:id', need('fc.settle'), ah(async (req, res) => {
  const s = await q1('select status from office.settlement where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!s) throw new HttpError(404, 'Расчёт не найден');
  if (s.status !== 'draft') throw new HttpError(409, 'Удалить можно только черновик');
  await q('delete from office.settlement where id = $1', [req.params.id]);
  await audit(req, 'settlement.delete', 'settlement', req.params.id);
  res.json({ ok: true });
}));
