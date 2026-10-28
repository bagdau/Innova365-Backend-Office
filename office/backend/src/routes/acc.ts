import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1 } from '../db';
import { loadModel } from '../cost';
import { cogs, methodLabel, payBetween, revenueByCategory, revenueByDay, sumDays } from '../reports';
import { ah, HttpError, isoDate, n, parse, periodOf, round2, todayIso } from '../util';

export const router = Router();
router.use('/acc', auth);

/* ───────── Выручка ───────── */
router.get('/acc/revenue', need('acc.view'), ah(async (req, res) => {
  const s = await getSettings(req.me!.rid);
  const { from, to } = periodOf(req, s.timezone);
  const rows = await revenueByDay(req.me!.rid, s.timezone, from, to);
  const t = sumDays(rows);
  res.json({ from, to, rows, total: { ...t, avgCheck: t.orders ? round2(t.revenue / t.orders) : 0 }, vat: s.vatEnabled ? round2(t.revenue * s.vat / (100 + s.vat)) : 0, vatRate: s.vatEnabled ? s.vat : 0 });
}));

/** Z-отчёт: закрытие дня. */
router.get('/acc/zreport', need('acc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const date = typeof req.query.date === 'string' ? parse(isoDate, req.query.date) : todayIso(s.timezone);
  const [days, orders, cancelled, cats] = await Promise.all([
    revenueByDay(rid, s.timezone, date, date),
    q(`select p.numero, p.tipo::text as tipo, m.numero as mesa, p.total, p."metodoPago", (p."actualizadoEn" at time zone 'UTC') as paid_at,
              (select coalesce(sum(ip.cantidad), 0)::int from public."ItemPedido" ip where ip."pedidoId" = p.id) as items
         from public."Pedido" p left join public."Mesa" m on m.id = p."mesaId"
        where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween('$3', '$3')} order by p."actualizadoEn"`, [rid, s.timezone, date]),
    q(`select count(*)::int as n, coalesce(sum(p.total), 0) as total from public."Pedido" p
        where p."restauranteId" = $1 and p.estado = 'CANCELADO' and ${payBetween('$3', '$3')}`, [rid, s.timezone, date]),
    revenueByCategory(rid, s.timezone, date, date),
  ]);
  const t = sumDays(days);
  const { orders: orderCount, ...totals } = t;
  res.json({
    date, ...totals, orderCount, avgCheck: orderCount ? round2(t.revenue / orderCount) : 0,
    vat: s.vatEnabled ? round2(t.revenue * s.vat / (100 + s.vat)) : 0, vatRate: s.vatEnabled ? s.vat : 0,
    cancelled: { count: cancelled[0].n, total: n(cancelled[0].total) }, categories: cats,
    orders: orders.map((o) => ({ numero: o.numero, tipo: o.tipo, mesa: o.mesa, total: n(o.total), method: methodLabel(o.metodoPago), paidAt: o.paid_at, items: o.items })),
  });
}));

/* ───────── Расходы ───────── */
const KINDS = ['opex', 'payroll', 'tax', 'rent', 'other'] as const;
const KIND_LABEL: Record<string, string> = { opex: 'Операционные', payroll: 'Персонал', tax: 'Налоги', rent: 'Аренда', other: 'Прочее' };

router.get('/acc/expense-categories', need('acc.view'), ah(async (req, res) => {
  const rows = await q(`select c.id, c.name, c.kind, c.active, (select count(*)::int from office.expense e where e.category_id = c.id) as used from office.expense_category c where c.restaurante_id = $1 order by c.active desc, lower(c.name)`, [req.me!.rid]);
  res.json(rows.map((r) => ({ ...r, kindLabel: KIND_LABEL[r.kind] })));
}));

const catBody = z.object({ name: z.string().trim().min(1, 'Укажите название').max(60), kind: z.enum(KINDS).default('opex'), active: z.boolean().default(true) });

router.post('/acc/expense-categories', need('acc.write'), ah(async (req, res) => {
  const b = parse(catBody, req.body);
  const r = await q1('insert into office.expense_category (restaurante_id, name, kind, active) values ($1,$2,$3,$4) returning id', [req.me!.rid, b.name, b.kind, b.active]);
  await audit(req, 'expense-category.create', 'expense_category', r!.id, b);
  res.status(201).json({ id: r!.id });
}));
router.put('/acc/expense-categories/:id', need('acc.write'), ah(async (req, res) => {
  const b = parse(catBody, req.body);
  const r = await q('update office.expense_category set name = $3, kind = $4, active = $5 where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid, b.name, b.kind, b.active]);
  if (!r.length) throw new HttpError(404, 'Категория не найдена');
  await audit(req, 'expense-category.update', 'expense_category', req.params.id, b);
  res.json({ ok: true });
}));
router.delete('/acc/expense-categories/:id', need('acc.write'), ah(async (req, res) => {
  const used = await q1('select 1 from office.expense where category_id = $1 limit 1', [req.params.id]);
  if (used) throw new HttpError(409, 'В категории есть расходы — отключите её вместо удаления');
  const r = await q('delete from office.expense_category where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Категория не найдена');
  await audit(req, 'expense-category.delete', 'expense_category', req.params.id);
  res.json({ ok: true });
}));

const expBody = z.object({
  date: isoDate, categoryId: z.string().min(1, 'Выберите категорию'),
  amount: z.number({ invalid_type_error: 'Сумма должна быть числом' }).positive('Сумма должна быть больше нуля').max(1e11),
  description: z.string().trim().max(300).nullish(), docNumber: z.string().trim().max(40).nullish(), counterparty: z.string().trim().max(120).nullish(),
  method: z.string().trim().max(30).nullish(), status: z.enum(['paid', 'pending']).default('paid'),
});
const expOut = (e: any) => ({ source: e.source ?? null, id: e.id, date: e.date, categoryId: e.category_id, category: e.category, kind: e.kind, amount: n(e.amount), description: e.description, docNumber: e.doc_number, counterparty: e.counterparty, method: e.method, status: e.status, createdBy: e.created_by });

router.get('/acc/expenses', need('acc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const cat = typeof req.query.categoryId === 'string' && req.query.categoryId ? req.query.categoryId : null;
  const status = typeof req.query.status === 'string' && ['paid', 'pending'].includes(req.query.status) ? req.query.status : null;
  const rows = await q(
    `select e.*, c.name as category, c.kind from office.expense e join office.expense_category c on c.id = e.category_id
      where e.restaurante_id = $1 and e.date between $2::date and $3::date and ($4::text is null or e.category_id = $4) and ($5::text is null or e.status = $5)
      order by e.date desc, e.created_at desc limit 2000`, [rid, from, to, cat, status]);
  const byCat = new Map<string, { category: string; kind: string; total: number }>();
  let total = 0, pending = 0;
  for (const r of rows) {
    const x = byCat.get(r.category_id) ?? { category: r.category, kind: r.kind, total: 0 };
    x.total += n(r.amount); byCat.set(r.category_id, x); total += n(r.amount); if (r.status === 'pending') pending += n(r.amount);
  }
  res.json({ from, to, rows: rows.map(expOut), total: round2(total), pending: round2(pending), byCategory: [...byCat.values()].map((x) => ({ ...x, total: round2(x.total) })).sort((a, b) => b.total - a.total) });
}));

router.post('/acc/expenses', need('acc.write'), ah(async (req, res) => {
  const b = parse(expBody, req.body);
  const rid = req.me!.rid;
  const c = await q1('select 1 from office.expense_category where id = $1 and restaurante_id = $2', [b.categoryId, rid]);
  if (!c) throw new HttpError(400, 'Категория не найдена');
  const r = await q1(`insert into office.expense (restaurante_id, date, category_id, amount, description, doc_number, counterparty, method, status, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [rid, b.date, b.categoryId, b.amount, b.description ?? null, b.docNumber ?? null, b.counterparty ?? null, b.method ?? null, b.status, req.me!.name]);
  await audit(req, 'expense.create', 'expense', r!.id, { amount: b.amount, date: b.date });
  res.status(201).json({ id: r!.id });
}));
router.put('/acc/expenses/:id', need('acc.write'), ah(async (req, res) => {
  const b = parse(expBody, req.body);
  const rid = req.me!.rid;
  const c = await q1('select 1 from office.expense_category where id = $1 and restaurante_id = $2', [b.categoryId, rid]);
  if (!c) throw new HttpError(400, 'Категория не найдена');
  const ex = await q1<{ source: string | null }>('select source from office.expense where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!ex) throw new HttpError(404, 'Расход не найден');
  if (ex.source) throw new HttpError(409, 'Расход создан автоматически (зарплата, аванс) — измените его в разделе «Персонал»');
  const r = await q(`update office.expense set date=$3, category_id=$4, amount=$5, description=$6, doc_number=$7, counterparty=$8, method=$9, status=$10 where id = $1 and restaurante_id = $2 returning id`,
    [req.params.id, rid, b.date, b.categoryId, b.amount, b.description ?? null, b.docNumber ?? null, b.counterparty ?? null, b.method ?? null, b.status]);
  if (!r.length) throw new HttpError(404, 'Расход не найден');
  await audit(req, 'expense.update', 'expense', req.params.id, { amount: b.amount });
  res.json({ ok: true });
}));
router.delete('/acc/expenses/:id', need('acc.write'), ah(async (req, res) => {
  const ex = await q1<{ source: string | null }>('select source from office.expense where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (ex?.source) throw new HttpError(409, 'Расход создан автоматически (зарплата, аванс) — удалите его в разделе «Персонал»');
  const r = await q('delete from office.expense where id = $1 and restaurante_id = $2 returning id, amount', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Расход не найден');
  await audit(req, 'expense.delete', 'expense', req.params.id, { amount: n(r[0].amount) });
  res.json({ ok: true });
}));

/* ───────── Закупки и оплаты поставщикам ───────── */
const purchaseSelect = `
  select c.id, c.numero, c.estado::text as estado, c."creadoEn" as created, c.total, pr.nombre as supplier,
         coalesce((select sum(ri.cantidad * ri."costoUnitario") from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" where rc."compraId" = c.id), 0) as received,
         coalesce((select sum(pp.amount) from office.purchase_payment pp where pp.compra_id = c.id), 0) as paid
    from public."Compra" c join public."Proveedor" pr on pr.id = c."proveedorId"`;

router.get('/acc/purchases', need('acc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const onlyDebt = req.query.debt === '1';
  const rows = await q(`${purchaseSelect} where c."restauranteId" = $1 and c.estado <> 'CANCELADA' order by c."creadoEn" desc limit 500`, [rid]);
  const out = rows.map((r) => { const received = n(r.received), paid = n(r.paid); return { id: r.id, numero: r.numero, estado: r.estado, created: r.created, supplier: r.supplier, total: n(r.total), received: round2(received), paid: round2(paid), debt: round2(Math.max(0, received - paid)), overpaid: round2(Math.max(0, paid - received)) }; })
    .filter((r) => !onlyDebt || r.debt > 0);
  const bySupplier = new Map<string, number>();
  for (const r of out) bySupplier.set(r.supplier, (bySupplier.get(r.supplier) ?? 0) + r.debt);
  res.json({ rows: out, totalDebt: round2(out.reduce((a, r) => a + r.debt, 0)), bySupplier: [...bySupplier.entries()].filter(([, v]) => v > 0).map(([supplier, debt]) => ({ supplier, debt: round2(debt) })).sort((a, b) => b.debt - a.debt) });
}));

router.get('/acc/purchases/:id', need('acc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const r = await q1(`${purchaseSelect} where c.id = $1 and c."restauranteId" = $2`, [req.params.id, rid]);
  if (!r) throw new HttpError(404, 'Закупка не найдена');
  const [items, payments] = await Promise.all([
    q(`select i.id, ins.nombre, ins.unidad, i.cantidad, i."cantidadRecibida" as recibida, i."costoUnitario" as costo from public."CompraItem" i join public."Insumo" ins on ins.id = i."insumoId" where i."compraId" = $1 order by ins.nombre`, [req.params.id]),
    q('select id, date, amount, method, note, created_by from office.purchase_payment where compra_id = $1 order by date, created_at', [req.params.id]),
  ]);
  const received = n(r.received), paid = n(r.paid);
  res.json({ id: r.id, numero: r.numero, estado: r.estado, created: r.created, supplier: r.supplier, total: n(r.total), received: round2(received), paid: round2(paid), debt: round2(Math.max(0, received - paid)),
    items: items.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: n(i.cantidad), recibida: n(i.recibida), costo: n(i.costo), sum: round2(n(i.cantidad) * n(i.costo)) })),
    payments: payments.map((p) => ({ id: p.id, date: p.date, amount: n(p.amount), method: p.method, note: p.note, createdBy: p.created_by })) });
}));

router.post('/acc/purchases/:id/payments', need('acc.write'), ah(async (req, res) => {
  const b = parse(z.object({ date: isoDate, amount: z.number({ invalid_type_error: 'Сумма должна быть числом' }).positive('Сумма должна быть больше нуля').max(1e11), method: z.string().trim().max(30).nullish(), note: z.string().trim().max(200).nullish() }), req.body);
  const rid = req.me!.rid;
  const r = await q1(`${purchaseSelect} where c.id = $1 and c."restauranteId" = $2`, [req.params.id, rid]);
  if (!r) throw new HttpError(404, 'Закупка не найдена');
  if (r.estado === 'CANCELADA') throw new HttpError(409, 'Закупка отменена');
  const debt = n(r.received) - n(r.paid);
  if (b.amount > debt + 0.005) throw new HttpError(409, `Сумма больше долга по принятому товару (${round2(Math.max(0, debt))}). Сначала примите товар на складе.`);
  const p = await q1('insert into office.purchase_payment (restaurante_id, compra_id, date, amount, method, note, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id', [rid, req.params.id, b.date, b.amount, b.method ?? null, b.note ?? null, req.me!.name]);
  await audit(req, 'purchase.payment', 'purchase', req.params.id, { amount: b.amount });
  res.status(201).json({ id: p!.id });
}));

router.delete('/acc/payments/:id', need('acc.write'), ah(async (req, res) => {
  const r = await q('delete from office.purchase_payment where id = $1 and restaurante_id = $2 returning compra_id, amount', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Оплата не найдена');
  await audit(req, 'purchase.payment.delete', 'purchase', r[0].compra_id, { amount: n(r[0].amount) });
  res.json({ ok: true });
}));

/* ───────── ОПУ (прибыли и убытки) ───────── */
router.get('/acc/pnl', need('acc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const [days, cg, exp] = await Promise.all([
    revenueByDay(rid, s.timezone, from, to), cogs(rid, s.timezone, from, to),
    q(`select c.name, c.kind, sum(e.amount) as total from office.expense e join office.expense_category c on c.id = e.category_id where e.restaurante_id = $1 and e.date between $2::date and $3::date group by c.name, c.kind order by 3 desc`, [rid, from, to]),
  ]);
  const gross = sumDays(days).revenue;
  const vat = s.vatEnabled ? round2(gross * s.vat / (100 + s.vat)) : 0;
  const net = round2(gross - vat);
  const gp = round2(net - cg.total);
  const expenses = exp.map((e) => ({ category: e.name as string, kind: e.kind as string, total: round2(n(e.total)) }));
  const expTotal = round2(expenses.reduce((a, e) => a + e.total, 0));
  const profit = round2(gp - expTotal);
  res.json({
    from, to, revenueGross: round2(gross), vat, vatRate: s.vatEnabled ? s.vat : 0, revenueNet: net, cogs: cg.total, grossProfit: gp, grossMargin: net > 0 ? Math.round(gp / net * 1000) / 10 : null,
    expenses, expensesTotal: expTotal, netProfit: profit, netMargin: net > 0 ? Math.round(profit / net * 1000) / 10 : null,
    notes: { itemsWithoutCard: cg.noCard, revenueWithoutCard: cg.noCardRevenue, itemsIncomplete: cg.incomplete },
    topCost: cg.byProduct.filter((p) => p.cost !== null).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0)).slice(0, 10),
  });
}));

/* ───────── Склад в деньгах ───────── */
router.get('/acc/stock', need('acc.view'), ah(async (req, res) => {
  const m = await loadModel(req.me!.rid);
  const groups = new Map<string, { category: string; value: number; items: number; noCost: number; negative: number }>();
  const rows: { id: string; nombre: string; categoria: string; unidad: string; stock: number; costo: number | null; value: number | null }[] = [];
  for (const i of m.insumos.values()) {
    const cat = i.categoria || 'Без категории';
    const g = groups.get(cat) ?? { category: cat, value: 0, items: 0, noCost: 0, negative: 0 };
    g.items += 1;
    if (i.costo === null) g.noCost += 1; else g.value += Math.max(0, i.stock) * i.costo;
    if (i.stock < 0) g.negative += 1;
    groups.set(cat, g);
    rows.push({ id: i.id, nombre: i.nombre, categoria: cat, unidad: i.unidad, stock: i.stock, costo: i.costo, value: i.costo === null ? null : round2(Math.max(0, i.stock) * i.costo) });
  }
  const arr = [...groups.values()].map((g) => ({ ...g, value: round2(g.value) })).sort((a, b) => b.value - a.value);
  res.json({ total: round2(arr.reduce((a, g) => a + g.value, 0)), groups: arr, rows: rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1)) });
}));
