import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1, tx } from '../db';
import { ah, HttpError, n, parse, periodOf, round2, todayIso } from '../util';

/**
 * Поставщики: справочник (таблица Proveedor кассы + реквизиты Office), карточка с историей закупок и долгом,
 * акт сверки и динамика закупочных цен сырья. Долг = принято по накладным − оплачено (как в разделе «Закупки и долги»).
 */
export const router = Router();
router.use('/sup', auth);

const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const supplierBody = z.object({
  nombre: z.string().trim().min(2, 'Укажите название').max(120),
  contacto: optText(120), telefono: optText(40), email: z.string().trim().email('Некорректный email').max(120).nullish().or(z.literal('')).transform((v) => (v ? v : null)), notas: optText(500),
  bin: optText(20), address: optText(200), bank: optText(120), iban: optText(40), category: optText(60),
  paymentDays: z.number().int().min(0).max(365).nullish(),
});

const recvSql = `(select coalesce(sum(ri.cantidad * ri."costoUnitario"), 0) from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" where rc."compraId" = c.id)`;
const paidSql = `(select coalesce(sum(pp.amount), 0) from office.purchase_payment pp where pp.compra_id = c.id)`;

/* ───────── Список ───────── */
router.get('/sup/suppliers', need('sup.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const rows = await q(
    `select p.id, p.nombre, p.contacto, p.telefono, p.email, p.notas, p.activo, e.bin, e.address, e.bank, e.iban, e.payment_days, e.category,
            coalesce(s.cnt, 0)::int as purchases, s.last_at, coalesce(s.received, 0) as received, coalesce(s.paid, 0) as paid, coalesce(s.overdue, 0) as overdue
       from public."Proveedor" p left join office.supplier_ext e on e.proveedor_id = p.id
       left join lateral (
         select count(*) as cnt, max(x.created) as last_at, sum(x.rec) as received, sum(x.paid) as paid,
                sum(case when e.payment_days is not null and x.last_rec is not null and (x.last_rec at time zone 'UTC' at time zone $2)::date + e.payment_days < (now() at time zone $2)::date then greatest(0, x.rec - x.paid) else 0 end) as overdue
           from (select c."creadoEn" as created, ${recvSql} as rec, ${paidSql} as paid,
                        (select max(rc."creadoEn") from public."Recepcion" rc where rc."compraId" = c.id) as last_rec
                   from public."Compra" c where c."proveedorId" = p.id and c.estado <> 'CANCELADA') x) s on true
      where p."restauranteId" = $1 order by p.activo desc, lower(p.nombre)`, [rid, tz]);
  const list = rows.map((r) => ({ id: r.id, nombre: r.nombre, contacto: r.contacto, telefono: r.telefono, email: r.email, notas: r.notas, activo: r.activo,
    bin: r.bin, address: r.address, bank: r.bank, iban: r.iban, paymentDays: r.payment_days, category: r.category,
    purchases: r.purchases, lastAt: r.last_at, received: round2(n(r.received)), paid: round2(n(r.paid)), debt: round2(Math.max(0, n(r.received) - n(r.paid))), overdue: round2(n(r.overdue)) }));
  res.json({ rows: list, totalDebt: round2(list.reduce((a, r) => a + r.debt, 0)), totalOverdue: round2(list.reduce((a, r) => a + r.overdue, 0)) });
}));

/* ───────── Создание и изменение ───────── */
async function saveExt(rid: string, id: string, b: z.infer<typeof supplierBody>) {
  await q(`insert into office.supplier_ext (proveedor_id, restaurante_id, bin, address, bank, iban, payment_days, category) values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (proveedor_id) do update set bin = excluded.bin, address = excluded.address, bank = excluded.bank, iban = excluded.iban, payment_days = excluded.payment_days, category = excluded.category, updated_at = now()`,
    [id, rid, b.bin, b.address, b.bank, b.iban, b.paymentDays ?? null, b.category]);
}

router.post('/sup/suppliers', need('sup.edit'), ah(async (req, res) => {
  const b = parse(supplierBody, req.body);
  const rid = req.me!.rid;
  const dup = await q1('select 1 from public."Proveedor" where "restauranteId" = $1 and lower(nombre) = lower($2)', [rid, b.nombre]);
  if (dup) throw new HttpError(409, 'Поставщик с таким названием уже есть');
  const r = await q1<{ id: string }>(`insert into public."Proveedor" (id, nombre, contacto, telefono, email, notas, activo, "restauranteId") values ('prov-' || gen_random_uuid()::text, $1,$2,$3,$4,$5,true,$6) returning id`,
    [b.nombre, b.contacto, b.telefono, b.email, b.notas, rid]);
  await saveExt(rid, r!.id, b);
  await audit(req, 'supplier.create', 'supplier', r!.id, { nombre: b.nombre });
  res.status(201).json({ id: r!.id });
}));

router.patch('/sup/suppliers/:id', need('sup.edit'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const b = parse(supplierBody.partial().extend({ activo: z.boolean().optional() }), req.body);
  const cur = await q1('select p.nombre, p.contacto, p.telefono, p.email, p.notas, e.bin, e.address, e.bank, e.iban, e.payment_days, e.category from public."Proveedor" p left join office.supplier_ext e on e.proveedor_id = p.id where p.id = $1 and p."restauranteId" = $2', [req.params.id, rid]);
  if (!cur) throw new HttpError(404, 'Поставщик не найден');
  if (b.nombre) {
    const dup = await q1('select 1 from public."Proveedor" where "restauranteId" = $1 and lower(nombre) = lower($2) and id <> $3', [rid, b.nombre, req.params.id]);
    if (dup) throw new HttpError(409, 'Поставщик с таким названием уже есть');
  }
  const m = { nombre: b.nombre ?? cur.nombre, contacto: b.contacto !== undefined ? b.contacto : cur.contacto, telefono: b.telefono !== undefined ? b.telefono : cur.telefono, email: b.email !== undefined ? b.email : cur.email, notas: b.notas !== undefined ? b.notas : cur.notas };
  await q('update public."Proveedor" set nombre = $2, contacto = $3, telefono = $4, email = $5, notas = $6, activo = coalesce($7, activo) where id = $1', [req.params.id, m.nombre, m.contacto, m.telefono, m.email, m.notas, b.activo ?? null]);
  await saveExt(rid, req.params.id, {
    ...m, bin: b.bin !== undefined ? b.bin : cur.bin, address: b.address !== undefined ? b.address : cur.address, bank: b.bank !== undefined ? b.bank : cur.bank, iban: b.iban !== undefined ? b.iban : cur.iban,
    category: b.category !== undefined ? b.category : cur.category, paymentDays: b.paymentDays !== undefined ? b.paymentDays : cur.payment_days,
  } as z.infer<typeof supplierBody>);
  await audit(req, 'supplier.update', 'supplier', req.params.id, b);
  res.json({ ok: true });
}));

router.delete('/sup/suppliers/:id', need('sup.edit'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const used = await q1<{ c: number }>('select count(*)::int as c from public."Compra" where "proveedorId" = $1', [req.params.id]);
  if (used && used.c > 0) throw new HttpError(409, `У поставщика есть закупки (${used.c}) — удалить нельзя. Отключите его: история сохранится.`);
  const r = await q('delete from public."Proveedor" where id = $1 and "restauranteId" = $2 returning id', [req.params.id, rid]);
  if (!r.length) throw new HttpError(404, 'Поставщик не найден');
  await q('delete from office.supplier_ext where proveedor_id = $1', [req.params.id]);
  await audit(req, 'supplier.delete', 'supplier', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Карточка ───────── */
router.get('/sup/suppliers/:id', need('sup.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const p = await q1('select p.*, e.bin, e.address, e.bank, e.iban, e.payment_days, e.category from public."Proveedor" p left join office.supplier_ext e on e.proveedor_id = p.id where p.id = $1 and p."restauranteId" = $2', [req.params.id, rid]);
  if (!p) throw new HttpError(404, 'Поставщик не найден');
  const [purchases, payments, items] = await Promise.all([
    q(`select c.id, c.numero, c.estado::text as estado, c."creadoEn" as created, c.total, ${recvSql} as rec, ${paidSql} as paid,
              (select max(rc."creadoEn") from public."Recepcion" rc where rc."compraId" = c.id) as last_rec
         from public."Compra" c where c."proveedorId" = $1 and c."restauranteId" = $2 order by c."creadoEn" desc limit 200`, [req.params.id, rid]),
    q(`select pp.id, pp.date, pp.amount, pp.method, c.numero from office.purchase_payment pp join public."Compra" c on c.id = pp.compra_id where c."proveedorId" = $1 and pp.restaurante_id = $2 order by pp.date desc, pp.created_at desc limit 100`, [req.params.id, rid]),
    q(`select i.id, i.nombre, i.unidad, sum(ri.cantidad) as qty, sum(ri.cantidad * ri."costoUnitario") as total,
              (array_agg(ri."costoUnitario" order by rc."creadoEn" desc))[1] as last_price, (array_agg(ri."costoUnitario" order by rc."creadoEn" desc))[2] as prev_price
         from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" join public."Compra" c on c.id = rc."compraId" join public."Insumo" i on i.id = ri."insumoId"
        where c."proveedorId" = $1 and c."restauranteId" = $2 and ri.cantidad > 0 group by i.id, i.nombre, i.unidad order by total desc limit 50`, [req.params.id, rid]),
  ]);
  const list = purchases.map((r) => ({ id: r.id, numero: r.numero, estado: r.estado, created: r.created, total: n(r.total), received: round2(n(r.rec)), paid: round2(n(r.paid)), debt: r.estado === 'CANCELADA' ? 0 : round2(Math.max(0, n(r.rec) - n(r.paid))) }));
  res.json({
    supplier: { id: p.id, nombre: p.nombre, contacto: p.contacto, telefono: p.telefono, email: p.email, notas: p.notas, activo: p.activo, bin: p.bin, address: p.address, bank: p.bank, iban: p.iban, paymentDays: p.payment_days, category: p.category },
    totals: { purchases: list.filter((x) => x.estado !== 'CANCELADA').length, received: round2(list.reduce((a, r) => a + r.received, 0)), paid: round2(list.reduce((a, r) => a + r.paid, 0)), debt: round2(list.reduce((a, r) => a + r.debt, 0)) },
    purchases: list,
    payments: payments.map((x) => ({ id: x.id, date: x.date, amount: n(x.amount), method: x.method, purchase: x.numero })),
    items: items.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, qty: n(i.qty), total: round2(n(i.total)), lastPrice: n(i.last_price), prevPrice: i.prev_price === null ? null : n(i.prev_price) })),
  });
}));

/* ───────── Акт сверки ───────── */
router.get('/sup/suppliers/:id/reconciliation', need('sup.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const p = await q1('select p.id, p.nombre, e.bin, e.address from public."Proveedor" p left join office.supplier_ext e on e.proveedor_id = p.id where p.id = $1 and p."restauranteId" = $2', [req.params.id, rid]);
  if (!p) throw new HttpError(404, 'Поставщик не найден');
  const day = `(rc."creadoEn" at time zone 'UTC' at time zone $3)::date`;
  const receipts = await q(
    `select rc.id, ${day} as d, c.numero, sum(ri.cantidad * ri."costoUnitario") as amount
       from public."Recepcion" rc join public."Compra" c on c.id = rc."compraId" join public."RecepcionItem" ri on ri."recepcionId" = rc.id
      where c."proveedorId" = $1 and c."restauranteId" = $2 and c.estado <> 'CANCELADA' group by rc.id, rc."creadoEn", c.numero having sum(ri.cantidad * ri."costoUnitario") <> 0 order by rc."creadoEn"`, [req.params.id, rid, s.timezone]);
  const pays = await q(
    `select pp.id, pp.date as d, pp.amount, pp.method, c.numero from office.purchase_payment pp join public."Compra" c on c.id = pp.compra_id
      where c."proveedorId" = $1 and pp.restaurante_id = $2 and c.estado <> 'CANCELADA' order by pp.date, pp.created_at`, [req.params.id, rid]);
  let opening = 0;
  const ops: { date: string; kind: 'receipt' | 'payment'; doc: string; amount: number }[] = [];
  for (const r of receipts) { const a = n(r.amount); if (r.d < from) opening += a; else if (r.d <= to) ops.push({ date: r.d, kind: 'receipt', doc: `Приёмка по закупке №${r.numero}`, amount: round2(a) }); }
  for (const r of pays) { const a = n(r.amount); if (r.d < from) opening -= a; else if (r.d <= to) ops.push({ date: r.d, kind: 'payment', doc: `Оплата по закупке №${r.numero}${r.method ? ` (${r.method})` : ''}`, amount: round2(a) }); }
  ops.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'receipt' ? -1 : 1));
  let bal = round2(opening);
  const rows = ops.map((o) => { bal = round2(bal + (o.kind === 'receipt' ? o.amount : -o.amount)); return { ...o, balance: bal }; });
  res.json({
    supplier: { id: p.id, nombre: p.nombre, bin: p.bin, address: p.address }, company: { name: s.company, bin: s.bin, address: s.address, signer: s.signer }, from, to,
    opening: round2(opening), delivered: round2(ops.filter((o) => o.kind === 'receipt').reduce((a, o) => a + o.amount, 0)), paid: round2(ops.filter((o) => o.kind === 'payment').reduce((a, o) => a + o.amount, 0)),
    closing: bal, rows, printedAt: todayIso(s.timezone),
  });
}));

/* ───────── Динамика закупочных цен ───────── */
router.get('/sup/prices', need('sup.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const rows = await q(
    `with p as (
       select ri."insumoId" as iid, ri."costoUnitario" as price, rc."creadoEn" as at, c."proveedorId" as sid,
              row_number() over (partition by ri."insumoId" order by rc."creadoEn" desc, ri.id desc) as rn
         from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" join public."Compra" c on c.id = rc."compraId"
        where rc."restauranteId" = $1 and ri.cantidad > 0)
     select i.id, i.nombre, i.unidad, i.categoria, i."costoUnitario" as cost,
            max(p.price) filter (where p.rn = 1) as last_price, max(p.at) filter (where p.rn = 1) as last_at, max(p.price) filter (where p.rn = 2) as prev_price,
            avg(p.price) filter (where p.at > now() - interval '90 days') as avg90, min(p.price) filter (where p.at > now() - interval '365 days') as min365, max(p.price) filter (where p.at > now() - interval '365 days') as max365,
            count(p.rn)::int as cnt, count(distinct p.sid)::int as suppliers
       from public."Insumo" i left join p on p.iid = i.id where i."restauranteId" = $1 group by i.id order by lower(i.nombre)`, [rid]);
  const list = rows.map((r) => {
    const last = r.last_price === null ? null : n(r.last_price), prev = r.prev_price === null ? null : n(r.prev_price), cost = r.cost === null ? null : n(r.cost);
    const change = last !== null && prev !== null && prev > 0 ? round2(((last - prev) / prev) * 100) : null;
    const drift = last !== null && cost !== null && cost > 0 ? round2(((last - cost) / cost) * 100) : null;   // насколько справочная цена отстала от последней закупки
    return { id: r.id, nombre: r.nombre, unidad: r.unidad, categoria: r.categoria, cost, last, lastAt: r.last_at, prev, change, drift, avg90: r.avg90 === null ? null : round2(n(r.avg90)), min365: r.min365 === null ? null : n(r.min365), max365: r.max365 === null ? null : n(r.max365), purchases: r.cnt, suppliers: r.suppliers };
  });
  res.json({ rows: list, rising: list.filter((x) => (x.change ?? 0) >= 10).length, stale: list.filter((x) => Math.abs(x.drift ?? 0) >= 5).length });
}));

router.get('/sup/prices/:insumoId', need('sup.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const i = await q1('select id, nombre, unidad, "costoUnitario" as cost from public."Insumo" where id = $1 and "restauranteId" = $2', [req.params.insumoId, rid]);
  if (!i) throw new HttpError(404, 'Сырьё не найдено');
  const tz = (await getSettings(rid)).timezone;
  const pts = await q(
    `select (rc."creadoEn" at time zone 'UTC' at time zone $3)::date as d, ri."costoUnitario" as price, ri.cantidad as qty, pr.nombre as supplier, c.numero
       from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" join public."Compra" c on c.id = rc."compraId" join public."Proveedor" pr on pr.id = c."proveedorId"
      where ri."insumoId" = $1 and rc."restauranteId" = $2 and ri.cantidad > 0 order by rc."creadoEn" desc limit 120`, [req.params.insumoId, rid, tz]);
  res.json({ insumo: { id: i.id, nombre: i.nombre, unidad: i.unidad, cost: i.cost === null ? null : n(i.cost) }, points: pts.map((x) => ({ date: x.d, price: n(x.price), qty: n(x.qty), supplier: x.supplier, purchase: x.numero })).reverse() });
}));

/** Применить цены последних закупок к справочнику сырья (меняет себестоимость техкарт). Нужно право на цены сырья. */
router.post('/sup/prices/apply', need('ing.cost'), ah(async (req, res) => {
  const b = parse(z.object({ insumoIds: z.array(z.string()).min(1).max(500) }), req.body);
  const rid = req.me!.rid;
  const changed = await tx(async (c) => {
    const r = await c.query(
      `update public."Insumo" i set "costoUnitario" = l.price, "actualizadoEn" = now()
         from (select distinct on (ri."insumoId") ri."insumoId" as iid, ri."costoUnitario" as price
                 from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId"
                where rc."restauranteId" = $1 and ri."insumoId" = any($2::text[]) and ri.cantidad > 0 order by ri."insumoId", rc."creadoEn" desc, ri.id desc) l
        where i.id = l.iid and i."restauranteId" = $1 and i."costoUnitario" is distinct from l.price returning i.id`, [rid, b.insumoIds]);
    return r.rowCount ?? 0;
  });
  await audit(req, 'prices.apply', 'ingredient', null, { count: changed });
  res.json({ changed });
}));
