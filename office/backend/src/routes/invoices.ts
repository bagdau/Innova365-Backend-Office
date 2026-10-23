import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1, tx } from '../db';
import { loadRentHistory, rentFor } from '../rent';
import { ah, HttpError, isoDate, n, parse, round2, todayIso } from '../util';

/**
 * Счета на оплату и акты оказанных услуг арендаторам фудкорта. Акт можно создать из взаиморасчёта (аренда + комиссия),
 * счёт на аренду — сразу для всех точек за месяц. Оплаты (в том числе зачёт в расчёте) закрывают счёт частично или полностью.
 */
export const router = Router();
router.use('/fc/invoices', auth);

export type InvoiceState = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';
const STATE_LABEL: Record<InvoiceState, string> = { draft: 'Черновик', issued: 'Выставлен', partial: 'Частично оплачен', paid: 'Оплачен', overdue: 'Просрочен', cancelled: 'Отменён' };

export function stateOf(status: string, total: number, paid: number, due: string | null, today: string): InvoiceState {
  if (status === 'draft') return 'draft';
  if (status === 'cancelled') return 'cancelled';
  if (total - paid <= 0.005) return 'paid';
  if (due && due < today) return 'overdue';
  return paid > 0 ? 'partial' : 'issued';
}

export const invoiceOut = (r: any, today: string) => {
  const total = n(r.total), paid = n(r.paid);
  const state = stateOf(r.status, total, paid, r.due_date, today);
  return {
    id: r.id, number: r.number, kind: r.kind, outletId: r.outlet_id, outletName: r.outlet_name, date: r.date, dueDate: r.due_date, periodFrom: r.period_from, periodTo: r.period_to, title: r.title, status: r.status,
    state, stateLabel: STATE_LABEL[state], total, paid: round2(paid), remaining: r.status === 'cancelled' ? 0 : round2(Math.max(0, total - paid)), settlementId: r.settlement_id, note: r.note, createdBy: r.created_by_name,
  };
};

const paidSql = '(select coalesce(sum(p.amount), 0) from office.invoice_payment p where p.invoice_id = i.id)';
export const invoiceSelect = `select i.*, o.name as outlet_name, ${paidSql} as paid from office.invoice i join office.outlet o on o.id = i.outlet_id`;

const lineSchema = z.object({ description: z.string().trim().min(1, 'Укажите наименование').max(200), qty: z.number().positive('Количество должно быть больше нуля').max(1e7).default(1), price: z.number({ invalid_type_error: 'Цена должна быть числом' }).min(0).max(1e10) });
const bodySchema = z.object({
  kind: z.enum(['invoice', 'act']), outletId: z.string().min(1, 'Выберите точку'), date: isoDate, dueDate: isoDate.nullish(), periodFrom: isoDate.nullish(), periodTo: isoDate.nullish(),
  title: z.string().trim().max(160).nullish(), note: z.string().trim().max(500).nullish(), lines: z.array(lineSchema).min(1, 'Добавьте хотя бы одну позицию').max(60), issue: z.boolean().optional(),
});

async function saveLines(c: { query: (t: string, v?: unknown[]) => Promise<{ rows: any[] }> }, id: string, lines: z.infer<typeof lineSchema>[]) {
  await c.query('delete from office.invoice_line where invoice_id = $1', [id]);
  let total = 0, i = 0;
  for (const l of lines) {
    const amount = round2(l.qty * l.price);
    total += amount;
    await c.query('insert into office.invoice_line (invoice_id, position, description, qty, price, amount) values ($1,$2,$3,$4,$5,$6)', [id, i++, l.description, l.qty, l.price, amount]);
  }
  await c.query('update office.invoice set total = $2 where id = $1', [id, round2(total)]);
}

/* ───────── Список ───────── */
router.get('/fc/invoices', need('fc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const outletId = typeof req.query.outletId === 'string' && req.query.outletId ? req.query.outletId : null;
  const kind = typeof req.query.kind === 'string' && ['invoice', 'act'].includes(req.query.kind) ? req.query.kind : null;
  const rows = await q(`${invoiceSelect} where i.restaurante_id = $1 and ($2::text is null or i.outlet_id = $2) and ($3::text is null or i.kind = $3) order by i.date desc, i.number desc limit 500`, [rid, outletId, kind]);
  const today = todayIso(tz);
  const list = rows.map((r) => invoiceOut(r, today));
  res.json({ rows: list, today, totals: { open: round2(list.filter((r) => ['issued', 'partial', 'overdue'].includes(r.state)).reduce((s, r) => s + r.remaining, 0)), overdue: round2(list.filter((r) => r.state === 'overdue').reduce((s, r) => s + r.remaining, 0)), overdueCount: list.filter((r) => r.state === 'overdue').length } });
}));

router.get('/fc/invoices/:id', need('fc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const r = await q1(`${invoiceSelect} where i.id = $1 and i.restaurante_id = $2`, [req.params.id, rid]);
  if (!r) throw new HttpError(404, 'Документ не найден');
  const [lines, pays, outlet] = await Promise.all([
    q('select description, qty, price, amount from office.invoice_line where invoice_id = $1 order by position', [r.id]),
    q('select id, date, amount, method, note, created_by_name from office.invoice_payment where invoice_id = $1 order by date, created_at', [r.id]),
    q1('select name, legal_name, bin, contact, phone, email from office.outlet where id = $1', [r.outlet_id]),
  ]);
  res.json({
    ...invoiceOut(r, todayIso(s.timezone)),
    lines: lines.map((l) => ({ description: l.description, qty: n(l.qty), price: n(l.price), amount: n(l.amount) })),
    payments: pays.map((p) => ({ id: p.id, date: p.date, amount: n(p.amount), method: p.method, note: p.note, who: p.created_by_name })),
    outlet: { name: outlet!.name, legalName: outlet!.legal_name, bin: outlet!.bin, contact: outlet!.contact, phone: outlet!.phone, email: outlet!.email },
    company: { name: s.company, bin: s.bin, address: s.address, signer: s.signer },
  });
}));

/* ───────── Создание и изменение ───────── */
async function checkOutlet(rid: string, id: string) {
  const o = await q1('select 1 from office.outlet where id = $1 and restaurante_id = $2', [id, rid]);
  if (!o) throw new HttpError(400, 'Точка не найдена');
}

router.post('/fc/invoices', need('fc.settle'), ah(async (req, res) => {
  const b = parse(bodySchema, req.body);
  const rid = req.me!.rid;
  await checkOutlet(rid, b.outletId);
  if (b.dueDate && b.dueDate < b.date) throw new HttpError(400, 'Срок оплаты раньше даты документа');
  const id = await tx(async (c) => {
    const r = (await c.query(`insert into office.invoice (restaurante_id, kind, outlet_id, date, due_date, period_from, period_to, title, note, status, issued_at, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [rid, b.kind, b.outletId, b.date, b.dueDate ?? null, b.periodFrom ?? null, b.periodTo ?? null, b.title ?? null, b.note ?? null, b.issue ? 'issued' : 'draft', b.issue ? new Date() : null, req.me!.name])).rows[0];
    await saveLines(c, r.id, b.lines);
    return r.id as string;
  });
  await audit(req, 'invoice.create', 'invoice', id, { kind: b.kind, outletId: b.outletId });
  res.status(201).json({ id });
}));

router.put('/fc/invoices/:id', need('fc.settle'), ah(async (req, res) => {
  const b = parse(bodySchema.omit({ kind: true, outletId: true, issue: true }), req.body);
  const rid = req.me!.rid;
  await tx(async (c) => {
    const r = (await c.query('select status from office.invoice where id = $1 and restaurante_id = $2 for update', [req.params.id, rid])).rows[0];
    if (!r) throw new HttpError(404, 'Документ не найден');
    if (r.status !== 'draft') throw new HttpError(409, 'Изменить можно только черновик');
    await c.query('update office.invoice set date = $2, due_date = $3, period_from = $4, period_to = $5, title = $6, note = $7 where id = $1', [req.params.id, b.date, b.dueDate ?? null, b.periodFrom ?? null, b.periodTo ?? null, b.title ?? null, b.note ?? null]);
    await saveLines(c, req.params.id, b.lines);
  });
  await audit(req, 'invoice.update', 'invoice', req.params.id);
  res.json({ ok: true });
}));

router.post('/fc/invoices/:id/issue', need('fc.settle'), ah(async (req, res) => {
  const r = await q(`update office.invoice set status = 'issued', issued_at = now() where id = $1 and restaurante_id = $2 and status = 'draft' and total > 0 returning id`, [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(409, 'Выставить можно только черновик с ненулевой суммой');
  await audit(req, 'invoice.issue', 'invoice', req.params.id);
  res.json({ ok: true });
}));

router.post('/fc/invoices/:id/cancel', need('fc.settle'), ah(async (req, res) => {
  const cur = await q1<{ status: string; paid: string }>(`select i.status, ${paidSql} as paid from office.invoice i where i.id = $1 and i.restaurante_id = $2`, [req.params.id, req.me!.rid]);
  if (!cur) throw new HttpError(404, 'Документ не найден');
  if (cur.status !== 'issued') throw new HttpError(409, 'Отменить можно только выставленный документ');
  if (n(cur.paid) > 0) throw new HttpError(409, 'По документу есть оплаты — сначала удалите их');
  await q(`update office.invoice set status = 'cancelled' where id = $1`, [req.params.id]);
  await audit(req, 'invoice.cancel', 'invoice', req.params.id);
  res.json({ ok: true });
}));

router.delete('/fc/invoices/:id', need('fc.settle'), ah(async (req, res) => {
  const r = await q(`delete from office.invoice where id = $1 and restaurante_id = $2 and status in ('draft', 'cancelled') returning id`, [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(409, 'Удалить можно только черновик или отменённый документ');
  await audit(req, 'invoice.delete', 'invoice', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Оплаты ───────── */
router.post('/fc/invoices/:id/payments', need('fc.settle'), ah(async (req, res) => {
  const b = parse(z.object({ date: isoDate, amount: z.number({ invalid_type_error: 'Сумма должна быть числом' }).positive('Сумма должна быть больше нуля').max(1e11), method: z.string().trim().max(40).nullish(), note: z.string().trim().max(200).nullish() }), req.body);
  const rid = req.me!.rid;
  const id = await tx(async (c) => {
    const r = (await c.query(`select i.status, i.total, ${paidSql} as paid from office.invoice i where i.id = $1 and i.restaurante_id = $2 for update`, [req.params.id, rid])).rows[0];
    if (!r) throw new HttpError(404, 'Документ не найден');
    if (r.status !== 'issued') throw new HttpError(409, r.status === 'draft' ? 'Сначала выставьте документ' : 'Документ отменён');
    const left = n(r.total) - n(r.paid);
    if (b.amount > left + 0.005) throw new HttpError(409, `Сумма больше остатка к оплате (${round2(Math.max(0, left))})`);
    return (await c.query('insert into office.invoice_payment (invoice_id, restaurante_id, date, amount, method, note, created_by_name) values ($1,$2,$3,$4,$5,$6,$7) returning id', [req.params.id, rid, b.date, b.amount, b.method ?? null, b.note ?? null, req.me!.name])).rows[0].id as string;
  });
  await audit(req, 'invoice.payment', 'invoice', req.params.id, { amount: b.amount });
  res.status(201).json({ id });
}));

router.delete('/fc/invoices/payments/:id', need('fc.settle'), ah(async (req, res) => {
  const r = await q('delete from office.invoice_payment where id = $1 and restaurante_id = $2 returning invoice_id, amount', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Оплата не найдена');
  await audit(req, 'invoice.payment.delete', 'invoice', r[0].invoice_id, { amount: n(r[0].amount) });
  res.json({ ok: true });
}));

/* ───────── Автоматическое создание ───────── */
/** Счета на аренду за месяц для всех действующих точек. Повторный запуск не создаёт дубликатов. */
router.post('/fc/invoices/rent', need('fc.settle'), ah(async (req, res) => {
  const b = parse(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате ГГГГ-ММ'), issue: z.boolean().optional() }), req.body);
  const rid = req.me!.rid;
  const from = `${b.month}-01`, to = new Date(Date.UTC(Number(b.month.slice(0, 4)), Number(b.month.slice(5)), 0)).toISOString().slice(0, 10);
  const [outlets, hist, leases] = await Promise.all([
    q(`select * from office.outlet where restaurante_id = $1 and status = 'active'`, [rid]), loadRentHistory(rid),
    q(`select outlet_id, payment_day from office.lease where restaurante_id = $1 and status = 'active'`, [rid]),
  ]);
  const title = `Аренда за ${b.month}`;
  let created = 0, skipped = 0, zero = 0;
  for (const o of outlets) {
    const rent = rentFor(o, hist.get(o.id), from, to);
    if (rent <= 0) { zero++; continue; }
    const dup = await q1(`select 1 from office.invoice where outlet_id = $1 and kind = 'invoice' and title = $2 and status <> 'cancelled'`, [o.id, title]);
    if (dup) { skipped++; continue; }
    const day = Math.min(leases.find((l) => l.outlet_id === o.id)?.payment_day ?? 10, Number(to.slice(8)));
    const due = `${b.month}-${String(day).padStart(2, '0')}`;
    await tx(async (c) => {
      const r = (await c.query(`insert into office.invoice (restaurante_id, kind, outlet_id, date, due_date, period_from, period_to, title, status, issued_at, created_by_name) values ($1,'invoice',$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [rid, o.id, from, due, from, to, title, b.issue ? 'issued' : 'draft', b.issue ? new Date() : null, req.me!.name])).rows[0];
      await saveLines(c, r.id, [{ description: `Аренда торговой площади за ${b.month}`, qty: 1, price: rent }]);
    });
    created++;
  }
  await audit(req, 'invoice.rent', 'invoice', null, { month: b.month, created, skipped });
  res.json({ created, skipped, zero });
}));

/** Акт оказанных услуг по взаиморасчёту: аренда и комиссия фудкорта за период. */
router.post('/fc/invoices/from-settlement/:id', need('fc.settle'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const s = await q1('select * from office.settlement where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!s) throw new HttpError(404, 'Расчёт не найден');
  const dup = await q1(`select number from office.invoice where settlement_id = $1 and status <> 'cancelled'`, [s.id]);
  if (dup) throw new HttpError(409, `По этому расчёту уже есть документ №${dup.number}`);
  const lines: z.infer<typeof lineSchema>[] = [];
  if (n(s.rent) > 0) lines.push({ description: `Аренда торговой площади за период ${s.period_from} — ${s.period_to}`, qty: 1, price: n(s.rent) });
  if (n(s.commission) > 0) lines.push({ description: `Комиссия фудкорта ${n(s.commission_pct)}% с выручки ${n(s.revenue)}`, qty: 1, price: n(s.commission) });
  if (!lines.length) throw new HttpError(409, 'В расчёте нет ни аренды, ни комиссии — акт не нужен');
  const today = todayIso(tz);
  const id = await tx(async (c) => {
    const r = (await c.query(`insert into office.invoice (restaurante_id, kind, outlet_id, date, period_from, period_to, title, status, issued_at, settlement_id, created_by_name) values ($1,'act',$2,$3,$4,$5,$6,'issued',now(),$7,$8) returning id`,
      [rid, s.outlet_id, today, s.period_from, s.period_to, `Акт по расчёту №${s.number}`, s.id, req.me!.name])).rows[0];
    await saveLines(c, r.id, lines);
    return r.id as string;
  });
  await audit(req, 'invoice.from-settlement', 'invoice', id, { settlement: s.number });
  res.status(201).json({ id });
}));
