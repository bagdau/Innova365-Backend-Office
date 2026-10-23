import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1, tx } from '../db';
import { cogs, revenueByDay } from '../reports';
import { addDays, ah, HttpError, isoDate, n, parse, periodOf, round2 } from '../util';

/**
 * Деньги: счета (касса, банк, карта), единый журнал движения денег, отчёт ДДС, бюджет и налоговая оценка.
 * Журнал собирается из того, что уже есть в системе: выручка по способам оплаты, оплаченные расходы, оплаты поставщикам,
 * зарплата — плюс ручные операции и переводы между счетами. Остаток счёта = начальный остаток + движение.
 */
export const router = Router();
router.use('/fin', auth);

interface Account { id: string; name: string; kind: string; opening_balance: string; opening_date: string; methods: string[]; active: boolean; note: string | null }
interface Flow { date: string; accountId: string | null; dir: 'in' | 'out'; amount: number; category: string; label: string; source: 'sales' | 'expense' | 'purchase' | 'manual' | 'transfer'; ref: string | null }

const METHOD_RU: Record<string, string> = { cash: 'Наличные', card: 'Карта', qr: 'QR', transfer: 'Перевод', other: 'Наличные' };
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const monthOf = (d: string) => d.slice(0, 7);
const monthEnd = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате ГГГГ-ММ');

const accounts = (rid: string) => q<Account>('select id, name, kind, opening_balance, opening_date, methods, active, note from office.fin_account where restaurante_id = $1 order by active desc, created_at', [rid]);

/** Какой счёт принимает/отдаёт деньги по способу оплаты. */
function routeAccount(list: Account[], method: string | null, date: string): string | null {
  const active = list.filter((a) => a.active && a.opening_date <= date);   // счёт принимает деньги только с даты открытия
  const m = norm(method);
  const hit = m ? active.find((a) => a.methods.some((x) => norm(x) === m)) : undefined;
  return (hit ?? active.find((a) => a.kind === 'bank') ?? active[0])?.id ?? null;
}

async function flows(rid: string, tz: string, from: string, to: string, list: Account[]): Promise<Flow[]> {
  const out: Flow[] = [];
  const days = await revenueByDay(rid, tz, from, to);
  for (const d of days) {
    for (const [k, v] of [['cash', d.cash], ['card', d.card], ['qr', d.qr], ['transfer', d.transfer], ['other', d.other]] as [string, number][]) {
      if (v > 0) out.push({ date: d.date, accountId: routeAccount(list, METHOD_RU[k], d.date), dir: 'in', amount: round2(v), category: 'Выручка', label: `Выручка · ${METHOD_RU[k]}`, source: 'sales', ref: null });
    }
  }
  const [exp, pays, man] = await Promise.all([
    q(`select e.id, e.date, e.amount, e.method, e.description, e.counterparty, c.name as category from office.expense e join office.expense_category c on c.id = e.category_id
        where e.restaurante_id = $1 and e.status = 'paid' and e.date between $2::date and $3::date`, [rid, from, to]),
    q(`select pp.id, pp.date, pp.amount, pp.method, c.numero, pr.nombre as supplier from office.purchase_payment pp join public."Compra" c on c.id = pp.compra_id join public."Proveedor" pr on pr.id = c."proveedorId"
        where pp.restaurante_id = $1 and pp.date between $2::date and $3::date`, [rid, from, to]),
    q('select id, account_id, date, direction, amount, category, counterparty, description, transfer_id from office.fin_tx where restaurante_id = $1 and date between $2::date and $3::date', [rid, from, to]),
  ]);
  for (const e of exp) out.push({ date: e.date, accountId: routeAccount(list, e.method, e.date), dir: 'out', amount: n(e.amount), category: e.category, label: [e.description, e.counterparty].filter(Boolean).join(' · ') || e.category, source: 'expense', ref: e.id });
  for (const p of pays) out.push({ date: p.date, accountId: routeAccount(list, p.method, p.date), dir: 'out', amount: n(p.amount), category: 'Оплата поставщикам', label: `Закупка №${p.numero} · ${p.supplier}`, source: 'purchase', ref: p.id });
  for (const m of man) out.push({ date: m.date, accountId: m.account_id, dir: m.direction, amount: n(m.amount), category: m.category || (m.transfer_id ? 'Перевод между счетами' : m.direction === 'in' ? 'Прочие поступления' : 'Прочие расходы'), label: [m.description, m.counterparty].filter(Boolean).join(' · ') || (m.transfer_id ? 'Перевод между счетами' : ''), source: m.transfer_id ? 'transfer' : 'manual', ref: m.id });
  return out;
}

/** Остатки счетов на начало периода: то, что было на конец предыдущего дня, плюс начальные остатки счетов, открытых внутри периода. */
function openingOf(list: Account[], before: Map<string, number>, from: string, to: string, ids: string[]): number {
  return round2(ids.reduce((sum, id) => { const a = list.find((x) => x.id === id)!; return sum + (before.get(id) ?? 0) + (a.opening_date >= from && a.opening_date <= to ? n(a.opening_balance) : 0); }, 0));
}

/** Остатки счетов на конец дня asOf. */
async function balances(rid: string, tz: string, asOf: string, list: Account[]): Promise<Map<string, number>> {
  const res = new Map<string, number>();
  if (!list.length) return res;
  const start = list.reduce((m, a) => (a.opening_date < m ? a.opening_date : m), asOf);
  const fl = start <= asOf ? await flows(rid, tz, start, asOf, list) : [];
  for (const a of list) {
    if (a.opening_date > asOf) { res.set(a.id, 0); continue; }
    let b = n(a.opening_balance);
    for (const f of fl) if (f.accountId === a.id && f.date >= a.opening_date) b += f.dir === 'in' ? f.amount : -f.amount;
    res.set(a.id, round2(b));
  }
  return res;
}

/* ───────── Счета ───────── */
const accBody = z.object({
  name: z.string().trim().min(2, 'Укажите название').max(60), kind: z.enum(['cash', 'bank', 'card', 'other']),
  openingBalance: z.number({ invalid_type_error: 'Остаток должен быть числом' }).min(-1e12).max(1e12).default(0), openingDate: isoDate,
  methods: z.array(z.string().trim().min(1).max(30)).max(10).default([]), note: z.string().trim().max(200).nullish(), active: z.boolean().optional(),
});

router.get('/fin/accounts', need('fin.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const list = await accounts(rid);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
  const bal = await balances(rid, tz, today, list);
  const ms = today.slice(0, 8) + '01';
  const fl = list.length ? await flows(rid, tz, ms, today, list) : [];
  const rows = list.map((a) => {
    const mine = fl.filter((f) => f.accountId === a.id);
    return { id: a.id, name: a.name, kind: a.kind, openingBalance: n(a.opening_balance), openingDate: a.opening_date, methods: a.methods, active: a.active, note: a.note, balance: bal.get(a.id) ?? 0,
      monthIn: round2(mine.filter((f) => f.dir === 'in' && f.source !== 'transfer').reduce((s, f) => s + f.amount, 0)), monthOut: round2(mine.filter((f) => f.dir === 'out' && f.source !== 'transfer').reduce((s, f) => s + f.amount, 0)) };
  });
  res.json({ rows, total: round2(rows.filter((r) => r.active).reduce((s, r) => s + r.balance, 0)), today });
}));

router.post('/fin/accounts', need('fin.write'), ah(async (req, res) => {
  const b = parse(accBody, req.body);
  const dup = await q1('select 1 from office.fin_account where restaurante_id = $1 and lower(name) = lower($2)', [req.me!.rid, b.name]);
  if (dup) throw new HttpError(409, 'Счёт с таким названием уже есть');
  const r = await q1<{ id: string }>('insert into office.fin_account (restaurante_id, name, kind, opening_balance, opening_date, methods, note) values ($1,$2,$3,$4,$5,$6,$7) returning id', [req.me!.rid, b.name, b.kind, b.openingBalance, b.openingDate, b.methods, b.note ?? null]);
  await audit(req, 'account.create', 'fin_account', r!.id, { name: b.name });
  res.status(201).json({ id: r!.id });
}));

/** Два счёта по умолчанию: «Касса» (наличные) и «Банк» (карта, QR, переводы). */
router.post('/fin/accounts/defaults', need('fin.write'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const exist = await q1<{ c: number }>('select count(*)::int as c from office.fin_account where restaurante_id = $1', [rid]);
  if (exist && exist.c > 0) throw new HttpError(409, 'Счета уже созданы');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
  await q(`insert into office.fin_account (restaurante_id, name, kind, opening_date, methods) values ($1,'Касса (наличные)','cash',$2,'{Наличные}'), ($1,'Банковский счёт','bank',$2,'{Карта,QR,Перевод,Kaspi}')`, [rid, today]);
  await audit(req, 'account.defaults', 'fin_account');
  res.status(201).json({ ok: true });
}));

router.patch('/fin/accounts/:id', need('fin.write'), ah(async (req, res) => {
  const b = parse(accBody.partial(), req.body);
  const cur = await q1('select 1 from office.fin_account where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!cur) throw new HttpError(404, 'Счёт не найден');
  if (b.name) { const dup = await q1('select 1 from office.fin_account where restaurante_id = $1 and lower(name) = lower($2) and id <> $3', [req.me!.rid, b.name, req.params.id]); if (dup) throw new HttpError(409, 'Счёт с таким названием уже есть'); }
  await q(`update office.fin_account set name = coalesce($2, name), kind = coalesce($3, kind), opening_balance = coalesce($4, opening_balance), opening_date = coalesce($5::date, opening_date), methods = coalesce($6, methods), note = case when $7::boolean then $8 else note end, active = coalesce($9, active) where id = $1`,
    [req.params.id, b.name ?? null, b.kind ?? null, b.openingBalance ?? null, b.openingDate ?? null, b.methods ?? null, b.note !== undefined, b.note ?? null, b.active ?? null]);
  await audit(req, 'account.update', 'fin_account', req.params.id, b);
  res.json({ ok: true });
}));

router.delete('/fin/accounts/:id', need('fin.write'), ah(async (req, res) => {
  const used = await q1('select 1 from office.fin_tx where account_id = $1 limit 1', [req.params.id]);
  if (used) throw new HttpError(409, 'По счёту есть операции — отключите счёт вместо удаления');
  const r = await q('delete from office.fin_account where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Счёт не найден');
  await audit(req, 'account.delete', 'fin_account', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Журнал движения денег ───────── */
router.get('/fin/ledger', need('fin.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const { from, to } = periodOf(req, tz);
  const accId = typeof req.query.accountId === 'string' && req.query.accountId ? req.query.accountId : null;
  const list = await accounts(rid);
  const names = new Map(list.map((a) => [a.id, a.name]));
  const [fl, openBal, closeBal] = await Promise.all([flows(rid, tz, from, to, list), balances(rid, tz, addDays(from, -1), list), balances(rid, tz, to, list)]);
  const rows = fl.filter((f) => !accId || f.accountId === accId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.dir === 'in' ? -1 : 1));
  const ids = accId ? [accId] : list.filter((a) => a.active).map((a) => a.id);
  const sum = (m: Map<string, number>) => round2(ids.reduce((s, i) => s + (m.get(i) ?? 0), 0));
  const unassigned = round2(rows.filter((r) => r.accountId === null && r.source !== 'transfer').reduce((s, r) => s + (r.dir === 'in' ? r.amount : -r.amount), 0));
  res.json({
    from, to, hasAccounts: list.length > 0, opening: openingOf(list, openBal, from, to, ids), closing: sum(closeBal), unassigned,
    totalIn: round2(rows.filter((r) => r.dir === 'in' && r.source !== 'transfer').reduce((s, r) => s + r.amount, 0)), totalOut: round2(rows.filter((r) => r.dir === 'out' && r.source !== 'transfer').reduce((s, r) => s + r.amount, 0)),
    rows: rows.map((r) => ({ ...r, account: r.accountId ? names.get(r.accountId) ?? '—' : 'Без счёта', editable: r.source === 'manual' || r.source === 'transfer' })),
  });
}));

const txBody = z.object({
  accountId: z.string().min(1, 'Выберите счёт'), date: isoDate, direction: z.enum(['in', 'out']),
  amount: z.number({ invalid_type_error: 'Сумма должна быть числом' }).positive('Сумма должна быть больше нуля').max(1e11),
  category: z.string().trim().max(80).nullish(), counterparty: z.string().trim().max(120).nullish(), description: z.string().trim().max(300).nullish(), docNumber: z.string().trim().max(40).nullish(),
});

async function checkAccount(rid: string, id: string) {
  const a = await q1<{ active: boolean }>('select active from office.fin_account where id = $1 and restaurante_id = $2', [id, rid]);
  if (!a) throw new HttpError(400, 'Счёт не найден');
  if (!a.active) throw new HttpError(409, 'Счёт отключён');
}

router.post('/fin/tx', need('fin.write'), ah(async (req, res) => {
  const b = parse(txBody, req.body);
  await checkAccount(req.me!.rid, b.accountId);
  const r = await q1<{ id: string }>('insert into office.fin_tx (restaurante_id, account_id, date, direction, amount, category, counterparty, description, doc_number, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',
    [req.me!.rid, b.accountId, b.date, b.direction, b.amount, b.category ?? null, b.counterparty ?? null, b.description ?? null, b.docNumber ?? null, req.me!.name]);
  await audit(req, 'fin-tx.create', 'fin_tx', r!.id, { direction: b.direction, amount: b.amount });
  res.status(201).json({ id: r!.id });
}));

router.put('/fin/tx/:id', need('fin.write'), ah(async (req, res) => {
  const b = parse(txBody, req.body);
  const cur = await q1<{ transfer_id: string | null }>('select transfer_id from office.fin_tx where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!cur) throw new HttpError(404, 'Операция не найдена');
  if (cur.transfer_id) throw new HttpError(409, 'Перевод между счетами удаляется и создаётся заново');
  await checkAccount(req.me!.rid, b.accountId);
  await q('update office.fin_tx set account_id = $2, date = $3, direction = $4, amount = $5, category = $6, counterparty = $7, description = $8, doc_number = $9 where id = $1',
    [req.params.id, b.accountId, b.date, b.direction, b.amount, b.category ?? null, b.counterparty ?? null, b.description ?? null, b.docNumber ?? null]);
  await audit(req, 'fin-tx.update', 'fin_tx', req.params.id, { amount: b.amount });
  res.json({ ok: true });
}));

router.delete('/fin/tx/:id', need('fin.write'), ah(async (req, res) => {
  const cur = await q1<{ transfer_id: string | null }>('select transfer_id from office.fin_tx where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!cur) throw new HttpError(404, 'Операция не найдена');
  if (cur.transfer_id) await q('delete from office.fin_tx where transfer_id = $1 and restaurante_id = $2', [cur.transfer_id, req.me!.rid]);
  else await q('delete from office.fin_tx where id = $1', [req.params.id]);
  await audit(req, 'fin-tx.delete', 'fin_tx', req.params.id);
  res.json({ ok: true });
}));

router.post('/fin/transfers', need('fin.write'), ah(async (req, res) => {
  const b = parse(z.object({ fromId: z.string().min(1), toId: z.string().min(1), date: isoDate, amount: z.number().positive('Сумма должна быть больше нуля').max(1e11), note: z.string().trim().max(200).nullish() }), req.body);
  if (b.fromId === b.toId) throw new HttpError(400, 'Выберите разные счета');
  await checkAccount(req.me!.rid, b.fromId); await checkAccount(req.me!.rid, b.toId);
  const tid = randomUUID();
  await tx(async (c) => {
    for (const [acc, dir] of [[b.fromId, 'out'], [b.toId, 'in']]) {
      await c.query('insert into office.fin_tx (restaurante_id, account_id, date, direction, amount, category, description, transfer_id, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [req.me!.rid, acc, b.date, dir, b.amount, 'Перевод между счетами', b.note ?? null, tid, req.me!.name]);
    }
  });
  await audit(req, 'fin-transfer.create', 'fin_tx', tid, { amount: b.amount });
  res.status(201).json({ id: tid });
}));

/* ───────── Отчёт о движении денег (ДДС) ───────── */
router.get('/fin/cashflow', need('fin.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const { from, to } = periodOf(req, tz);
  const list = await accounts(rid);
  const [fl, openBal, closeBal] = await Promise.all([flows(rid, tz, from, to, list), balances(rid, tz, addDays(from, -1), list), balances(rid, tz, to, list)]);
  const real = fl.filter((f) => f.source !== 'transfer');
  const group = (dir: 'in' | 'out') => {
    const m = new Map<string, number>();
    for (const f of real) if (f.dir === dir) m.set(f.label.startsWith('Выручка') ? f.label : f.category, (m.get(f.label.startsWith('Выручка') ? f.label : f.category) ?? 0) + f.amount);
    return [...m].map(([name, total]) => ({ name, total: round2(total) })).sort((a, b) => b.total - a.total);
  };
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const f of real) { const k = monthOf(f.date); const x = byMonth.get(k) ?? { in: 0, out: 0 }; x[f.dir] += f.amount; byMonth.set(k, x); }
  const act = list.filter((a) => a.active).map((a) => a.id);
  const sum = (m: Map<string, number>) => round2(act.reduce((s, i) => s + (m.get(i) ?? 0), 0));
  const inflow = group('in'), outflow = group('out');
  const totalIn = round2(inflow.reduce((s, x) => s + x.total, 0)), totalOut = round2(outflow.reduce((s, x) => s + x.total, 0));
  res.json({
    from, to, hasAccounts: list.length > 0, opening: openingOf(list, openBal, from, to, act), closing: sum(closeBal), inflow, outflow, totalIn, totalOut, net: round2(totalIn - totalOut),
    unassigned: round2(real.filter((f) => f.accountId === null).reduce((s, f) => s + (f.dir === 'in' ? f.amount : -f.amount), 0)),
    months: [...byMonth].sort().map(([month, v]) => ({ month, in: round2(v.in), out: round2(v.out), net: round2(v.in - v.out) })),
    byAccount: list.map((a) => ({ id: a.id, name: a.name, opening: openingOf(list, openBal, from, to, [a.id]), closing: closeBal.get(a.id) ?? 0 })),
  });
}));

/* ───────── Бюджет ───────── */
async function budgetActuals(rid: string, tz: string, month: string) {
  const from = `${month}-01`, to = monthEnd(month);
  const [days, purch, exp] = await Promise.all([
    revenueByDay(rid, tz, from, to),
    q1<{ v: string }>(`select coalesce(sum(ri.cantidad * ri."costoUnitario"), 0) as v from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId"
                         where rc."restauranteId" = $1 and (rc."creadoEn" at time zone 'UTC' at time zone $2)::date between $3::date and $4::date`, [rid, tz, from, to]),
    q(`select c.id, c.name, c.kind, c.active, coalesce(sum(e.amount), 0) as total from office.expense_category c
         left join office.expense e on e.category_id = c.id and e.date between $2::date and $3::date where c.restaurante_id = $1 group by c.id order by c.name`, [rid, from, to]),
  ]);
  return { revenue: round2(days.reduce((s, d) => s + d.revenue, 0)), purchases: round2(n(purch?.v)), cats: exp };
}

router.get('/fin/budget', need('fin.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const month = parse(monthParam, String(req.query.month ?? new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date()).slice(0, 7)));
  const [act, plans] = await Promise.all([budgetActuals(rid, tz, month), q<{ key: string; amount: string }>('select key, amount from office.budget where restaurante_id = $1 and month = $2', [rid, month])]);
  const plan = new Map(plans.map((p) => [p.key, n(p.amount)]));
  const line = (key: string, label: string, kind: 'revenue' | 'purchases' | 'expense', actual: number) => {
    const p = plan.get(key) ?? 0;
    return { key, label, kind, plan: p, actual: round2(actual), variance: round2(kind === 'revenue' ? actual - p : p - actual), pct: p > 0 ? Math.round((actual / p) * 1000) / 10 : null };
  };
  const lines = [line('revenue', 'Выручка', 'revenue', act.revenue), line('purchases', 'Закупки сырья (принято)', 'purchases', act.purchases),
    ...act.cats.filter((c) => c.active || n(c.total) > 0 || plan.has('cat:' + c.id)).map((c) => line('cat:' + c.id, c.name, 'expense', n(c.total)))];
  const planCost = lines.filter((l) => l.kind !== 'revenue').reduce((s, l) => s + l.plan, 0), actCost = lines.filter((l) => l.kind !== 'revenue').reduce((s, l) => s + l.actual, 0);
  res.json({ month, lines, totals: { planRevenue: plan.get('revenue') ?? 0, actualRevenue: act.revenue, planCost: round2(planCost), actualCost: round2(actCost), planProfit: round2((plan.get('revenue') ?? 0) - planCost), actualProfit: round2(act.revenue - actCost) } });
}));

router.put('/fin/budget/:month', need('fin.write'), ah(async (req, res) => {
  const month = parse(monthParam, req.params.month);
  const b = parse(z.object({ lines: z.array(z.object({ key: z.string().min(1).max(80), amount: z.number().min(0).max(1e12) })).min(1).max(200) }), req.body);
  const rid = req.me!.rid;
  await tx(async (c) => {
    for (const l of b.lines) {
      if (l.amount === 0) await c.query('delete from office.budget where restaurante_id = $1 and month = $2 and key = $3', [rid, month, l.key]);
      else await c.query('insert into office.budget (restaurante_id, month, key, amount) values ($1,$2,$3,$4) on conflict (restaurante_id, month, key) do update set amount = excluded.amount, updated_at = now()', [rid, month, l.key, l.amount]);
    }
  });
  await audit(req, 'budget.save', 'budget', month, { lines: b.lines.length });
  res.json({ ok: true });
}));

router.post('/fin/budget/:month/copy', need('fin.write'), ah(async (req, res) => {
  const month = parse(monthParam, req.params.month);
  const src = parse(monthParam, req.body?.from);
  if (src === month) throw new HttpError(400, 'Выберите другой месяц');
  const r = await q(`insert into office.budget (restaurante_id, month, key, amount) select restaurante_id, $2, key, amount from office.budget where restaurante_id = $1 and month = $3
                     on conflict (restaurante_id, month, key) do update set amount = excluded.amount, updated_at = now() returning key`, [req.me!.rid, month, src]);
  await audit(req, 'budget.copy', 'budget', month, { from: src, lines: r.length });
  res.json({ copied: r.length });
}));

/** Подсказка плана: среднее фактическое за три предыдущих месяца (не сохраняется, пока вы не нажмёте «Сохранить»). */
router.get('/fin/budget/:month/suggest', need('fin.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const month = parse(monthParam, req.params.month);
  const prev: string[] = [];
  for (let i = 1; i <= 3; i++) { const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 - i, 1)); prev.push(d.toISOString().slice(0, 7)); }
  const acts = await Promise.all(prev.map((m) => budgetActuals(rid, tz, m)));
  const sum = new Map<string, number>();
  for (const a of acts) { sum.set('revenue', (sum.get('revenue') ?? 0) + a.revenue); sum.set('purchases', (sum.get('purchases') ?? 0) + a.purchases); for (const c of a.cats) sum.set('cat:' + c.id, (sum.get('cat:' + c.id) ?? 0) + n(c.total)); }
  res.json({ months: prev, values: Object.fromEntries([...sum].map(([k, v]) => [k, Math.round(v / prev.length)])) });
}));

/* ───────── Налоговая оценка ───────── */
const TAX_KEYS = ['tax.revenueRate', 'tax.profitRate', 'tax.note'];
async function taxCfg(rid: string) {
  const rows = await q<{ key: string; value: unknown }>('select key, value from office.setting where restaurante_id = $1 and key = any($2::text[])', [rid, TAX_KEYS]);
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return { revenueRate: Number(m.get('tax.revenueRate') ?? 0), profitRate: Number(m.get('tax.profitRate') ?? 0), note: String(m.get('tax.note') ?? '') };
}

router.get('/fin/tax', need('fin.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const year = z.coerce.number().int().min(2000).max(2100).parse(req.query.year ?? new Intl.DateTimeFormat('sv-SE', { timeZone: s.timezone }).format(new Date()).slice(0, 4));
  const cfg = await taxCfg(rid);
  const months: Record<string, unknown>[] = [];
  const payrolls = await q(`select p.period, p.status, p.employer_pct, coalesce(sum(l.base + l.bonus - l.penalty), 0) as gross, coalesce(sum(l.deduction), 0) as deduction
                              from office.hr_payroll p left join office.hr_payroll_line l on l.payroll_id = p.id where p.restaurante_id = $1 and p.period like $2 and p.status in ('approved', 'paid') group by p.id`, [rid, `${year}-%`]);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: s.timezone }).format(new Date());
  for (let mo = 1; mo <= 12; mo++) {
    const month = `${year}-${String(mo).padStart(2, '0')}`;
    if (`${month}-01` > today) break;
    const from = `${month}-01`, to = monthEnd(month);
    const [days, cg, ex] = await Promise.all([revenueByDay(rid, s.timezone, from, to), cogs(rid, s.timezone, from, to), q1<{ t: string }>('select coalesce(sum(amount), 0) as t from office.expense where restaurante_id = $1 and date between $2::date and $3::date', [rid, from, to])]);
    const revenue = round2(days.reduce((a, d) => a + d.revenue, 0));
    const vat = s.vatEnabled ? round2(revenue * s.vat / (100 + s.vat)) : 0;
    const expenses = round2(n(ex?.t));
    const profit = round2(revenue - vat - cg.total - expenses);
    const pr = payrolls.find((p) => p.period === month);
    const gross = pr ? n(pr.gross) : 0, employer = pr ? round2(gross * n(pr.employer_pct) / 100) : 0, withheld = pr ? n(pr.deduction) : 0;
    const turnoverTax = round2(revenue * cfg.revenueRate / 100), incomeTax = round2(Math.max(0, profit) * cfg.profitRate / 100);
    months.push({ month, revenue, vat, revenueNet: round2(revenue - vat), cogs: cg.total, expenses, profit, turnoverTax, incomeTax, withheld: round2(withheld), employer, total: round2(vat + turnoverTax + incomeTax + withheld + employer) });
  }
  const sumOf = (k: string) => round2(months.reduce((a, m) => a + (m[k] as number), 0));
  res.json({ year, config: cfg, vat: { enabled: s.vatEnabled, rate: s.vat }, months, totals: Object.fromEntries(['revenue', 'vat', 'revenueNet', 'cogs', 'expenses', 'profit', 'turnoverTax', 'incomeTax', 'withheld', 'employer', 'total'].map((k) => [k, sumOf(k)])) });
}));

router.put('/fin/tax/config', need('fin.write'), ah(async (req, res) => {
  const b = parse(z.object({ revenueRate: z.number().min(0).max(100), profitRate: z.number().min(0).max(100), note: z.string().trim().max(300).optional() }), req.body);
  for (const [k, v] of Object.entries({ 'tax.revenueRate': b.revenueRate, 'tax.profitRate': b.profitRate, 'tax.note': b.note ?? '' })) {
    await q(`insert into office.setting (restaurante_id, key, value) values ($1,$2,$3) on conflict (restaurante_id, key) do update set value = excluded.value, updated_at = now()`, [req.me!.rid, k, JSON.stringify(v)]);
  }
  await audit(req, 'tax.config', 'tax', null, b);
  res.json(await taxCfg(req.me!.rid));
}));
