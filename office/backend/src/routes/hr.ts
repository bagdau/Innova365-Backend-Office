import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1, tx } from '../db';
import { ah, HttpError, isoDate, n, parse, round2 } from '../util';

/**
 * Персонал: штат, табель, авансы и зарплатные ведомости.
 * Начисление: оклад — пропорционально отработанным дням к норме месяца; почасовая — часы × ставка; посуточная — дни × ставка.
 * Удержания и взносы работодателя считаются по ставкам, которые задаёт бухгалтер (по умолчанию 0%): система не подставляет
 * законодательные ставки сама. Выплата создаёт расходы в бухгалтерии — они попадают в ОПУ и в отчёт о движении денег.
 */
export const router = Router();
router.use('/hr', auth);

const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Месяц в формате ГГГГ-ММ');
const monthEnd = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const daysOf = (m: string): string[] => { const e = Number(monthEnd(m).slice(8)); return Array.from({ length: e }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`); };
const isWeekday = (iso: string) => { const d = new Date(iso + 'T00:00:00Z').getUTCDay(); return d !== 0 && d !== 6; };
const normDaysOf = (m: string) => daysOf(m).filter(isWeekday).length;

const KIND_LABEL: Record<string, string> = { salary: 'Оклад', hourly: 'Почасовая', daily: 'Посуточная' };

/* ───────── Штат ───────── */
const empBody = z.object({
  name: z.string().trim().min(2, 'Укажите имя').max(100), position: z.string().trim().max(80).nullish(), payKind: z.enum(['salary', 'hourly', 'daily']),
  rate: z.number({ invalid_type_error: 'Ставка должна быть числом' }).min(0).max(1e9), phone: z.string().trim().max(40).nullish(),
  hireDate: isoDate.nullish(), fireDate: isoDate.nullish(), posUserId: z.string().nullish(), note: z.string().trim().max(300).nullish(), active: z.boolean().optional(),
});
const empOut = (e: any) => ({ id: e.id, name: e.name, position: e.position, payKind: e.pay_kind, payKindLabel: KIND_LABEL[e.pay_kind], rate: n(e.rate), phone: e.phone, hireDate: e.hire_date, fireDate: e.fire_date, posUserId: e.pos_user_id, posUser: e.pos_name ?? null, active: e.active, note: e.note });

router.get('/hr/employees', need('hr.view'), ah(async (req, res) => {
  const rows = await q(`select e.*, u.nombre as pos_name from office.hr_employee e left join public."Usuario" u on u.id = e.pos_user_id where e.restaurante_id = $1 order by e.active desc, lower(e.name)`, [req.me!.rid]);
  res.json(rows.map(empOut));
}));

router.get('/hr/pos-users', need('hr.view'), ah(async (req, res) => {
  const rows = await q(`select u.id, u.nombre, u.rol::text as rol, u.activo, exists(select 1 from office.hr_employee e where e.pos_user_id = u.id) as linked from public."Usuario" u where u."restauranteId" = $1 order by lower(u.nombre)`, [req.me!.rid]);
  res.json(rows);
}));

async function checkPos(rid: string, id: string | null | undefined, exceptEmp?: string) {
  if (!id) return null;
  const u = await q1('select 1 from public."Usuario" where id = $1 and "restauranteId" = $2', [id, rid]);
  if (!u) throw new HttpError(400, 'Пользователь кассы не найден');
  const used = await q1('select 1 from office.hr_employee where pos_user_id = $1 and ($2::text is null or id <> $2)', [id, exceptEmp ?? null]);
  if (used) throw new HttpError(409, 'Этот пользователь кассы уже привязан к другому сотруднику');
  return id;
}

router.post('/hr/employees', need('hr.write'), ah(async (req, res) => {
  const b = parse(empBody, req.body);
  const pos = await checkPos(req.me!.rid, b.posUserId);
  const r = await q1<{ id: string }>('insert into office.hr_employee (restaurante_id, name, position, pay_kind, rate, phone, hire_date, fire_date, pos_user_id, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',
    [req.me!.rid, b.name, b.position ?? null, b.payKind, b.rate, b.phone ?? null, b.hireDate ?? null, b.fireDate ?? null, pos, b.note ?? null]);
  await audit(req, 'employee.create', 'employee', r!.id, { name: b.name });
  res.status(201).json({ id: r!.id });
}));

/** Завести в штате всех пользователей кассы, которых там ещё нет (ставку потом укажите вручную). */
router.post('/hr/employees/import-pos', need('hr.write'), ah(async (req, res) => {
  const LABEL: Record<string, string> = { MESERO: 'Официант', CAJERO: 'Кассир', COCINERO: 'Повар', REPARTIDOR: 'Доставщик', ADMIN: 'Администратор', SUPERADMIN: 'Владелец' };
  const rows = await q(`select u.id, u.nombre, u.rol::text as rol from public."Usuario" u where u."restauranteId" = $1 and u.activo and not exists (select 1 from office.hr_employee e where e.pos_user_id = u.id) order by u.nombre`, [req.me!.rid]);
  for (const u of rows) await q('insert into office.hr_employee (restaurante_id, name, position, pay_kind, rate, pos_user_id) values ($1,$2,$3,$4,0,$5)', [req.me!.rid, u.nombre, LABEL[u.rol] ?? u.rol, 'salary', u.id]);
  await audit(req, 'employee.import', 'employee', null, { count: rows.length });
  res.json({ imported: rows.length });
}));

router.patch('/hr/employees/:id', need('hr.write'), ah(async (req, res) => {
  const b = parse(empBody.partial(), req.body);
  const cur = await q1('select 1 from office.hr_employee where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!cur) throw new HttpError(404, 'Сотрудник не найден');
  const pos = b.posUserId === undefined ? undefined : await checkPos(req.me!.rid, b.posUserId, req.params.id);
  await q(`update office.hr_employee set name = coalesce($2, name), position = case when $3::boolean then $4 else position end, pay_kind = coalesce($5, pay_kind), rate = coalesce($6, rate), phone = case when $7::boolean then $8 else phone end,
           hire_date = case when $9::boolean then $10::date else hire_date end, fire_date = case when $11::boolean then $12::date else fire_date end, pos_user_id = case when $13::boolean then $14 else pos_user_id end,
           note = case when $15::boolean then $16 else note end, active = coalesce($17, active) where id = $1`,
    [req.params.id, b.name ?? null, b.position !== undefined, b.position ?? null, b.payKind ?? null, b.rate ?? null, b.phone !== undefined, b.phone ?? null, b.hireDate !== undefined, b.hireDate ?? null, b.fireDate !== undefined, b.fireDate ?? null,
      pos !== undefined, pos ?? null, b.note !== undefined, b.note ?? null, b.active ?? null]);
  await audit(req, 'employee.update', 'employee', req.params.id, b);
  res.json({ ok: true });
}));

router.delete('/hr/employees/:id', need('hr.write'), ah(async (req, res) => {
  const used = await q1('select 1 from office.hr_payroll_line where employee_id = $1 limit 1', [req.params.id]);
  if (used) throw new HttpError(409, 'Сотрудник есть в зарплатных ведомостях — отключите его вместо удаления');
  const adv = await q1('select 1 from office.hr_advance where employee_id = $1 limit 1', [req.params.id]);
  if (adv) throw new HttpError(409, 'У сотрудника есть авансы — отключите его вместо удаления');
  const r = await q('delete from office.hr_employee where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Сотрудник не найден');
  await audit(req, 'employee.delete', 'employee', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Табель ───────── */
router.get('/hr/timesheet', need('hr.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const tz = (await getSettings(rid)).timezone;
  const month = parse(monthParam, String(req.query.month ?? new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date()).slice(0, 7)));
  const days = daysOf(month);
  const emps = await q(`select * from office.hr_employee where restaurante_id = $1 and (active or exists(select 1 from office.hr_timesheet t where t.employee_id = hr_employee.id and t.date between $2::date and $3::date)) order by lower(name)`, [rid, days[0], days[days.length - 1]]);
  const cells = await q(`select employee_id, date, status, hours from office.hr_timesheet where date between $1::date and $2::date and employee_id = any($3::text[])`, [days[0], days[days.length - 1], emps.map((e) => e.id)]);
  const by = new Map<string, Record<string, { status: string; hours: number | null }>>();
  for (const c of cells) { const m = by.get(c.employee_id) ?? {}; m[c.date] = { status: c.status, hours: c.hours === null ? null : n(c.hours) }; by.set(c.employee_id, m); }
  res.json({
    month, days, norm: normDaysOf(month), weekends: days.filter((d) => !isWeekday(d)),
    employees: emps.map((e) => { const m = by.get(e.id) ?? {}; const vals = Object.values(m); return { id: e.id, name: e.name, position: e.position, payKind: e.pay_kind, active: e.active, cells: m, workDays: vals.filter((v) => v.status === 'work').length, hours: round2(vals.filter((v) => v.status === 'work').reduce((s, v) => s + (v.hours ?? 0), 0)) }; }),
  });
}));

const cellBody = z.object({ employeeId: z.string().min(1), date: isoDate, status: z.enum(['work', 'off', 'sick', 'vacation', 'absent']).nullable(), hours: z.number().min(0).max(24).nullish() });
async function setCell(rid: string, b: z.infer<typeof cellBody>) {
  const e = await q1('select 1 from office.hr_employee where id = $1 and restaurante_id = $2', [b.employeeId, rid]);
  if (!e) throw new HttpError(404, 'Сотрудник не найден');
  const locked = await q1(`select 1 from office.hr_payroll where restaurante_id = $1 and period = $2 and status in ('approved', 'paid')`, [rid, b.date.slice(0, 7)]);
  if (locked) throw new HttpError(409, 'Ведомость за этот месяц утверждена — табель изменить нельзя');
  if (b.status === null) await q('delete from office.hr_timesheet where employee_id = $1 and date = $2', [b.employeeId, b.date]);
  else await q(`insert into office.hr_timesheet (employee_id, date, status, hours) values ($1,$2,$3,$4) on conflict (employee_id, date) do update set status = excluded.status, hours = excluded.hours`, [b.employeeId, b.date, b.status, b.status === 'work' ? b.hours ?? 8 : null]);
}

router.put('/hr/timesheet', need('hr.write'), ah(async (req, res) => {
  await setCell(req.me!.rid, parse(cellBody, req.body));
  res.json({ ok: true });
}));

/** Проставить один статус на диапазон дат (например, отпуск или «рабочие дни месяца»). */
router.put('/hr/timesheet/range', need('hr.write'), ah(async (req, res) => {
  const b = parse(z.object({ employeeId: z.string().min(1), from: isoDate, to: isoDate, status: z.enum(['work', 'off', 'sick', 'vacation', 'absent']).nullable(), hours: z.number().min(0).max(24).nullish(), weekdaysOnly: z.boolean().optional() }), req.body);
  if (b.from > b.to) throw new HttpError(400, 'Начало периода позже конца');
  if (b.from.slice(0, 7) !== b.to.slice(0, 7)) throw new HttpError(400, 'Период должен быть в пределах одного месяца');
  let cnt = 0;
  for (const d of daysOf(b.from.slice(0, 7))) {
    if (d < b.from || d > b.to || (b.weekdaysOnly && !isWeekday(d))) continue;
    await setCell(req.me!.rid, { employeeId: b.employeeId, date: d, status: b.status, hours: b.hours }); cnt++;
  }
  res.json({ days: cnt });
}));

/* ───────── Авансы ───────── */
async function categoryOf(rid: string, kind: string): Promise<string> {
  const c = await q1<{ id: string }>('select id from office.expense_category where restaurante_id = $1 and kind = $2 and active order by created_at limit 1', [rid, kind]);
  if (!c) throw new HttpError(409, `Нет категории расходов типа «${kind === 'payroll' ? 'Зарплата' : 'Налоги'}». Создайте её в разделе «Расходы»`);
  return c.id;
}

router.get('/hr/advances', need('hr.view'), ah(async (req, res) => {
  const month = parse(monthParam, String(req.query.month ?? ''));
  const rows = await q(`select a.id, a.date, a.amount, a.method, a.note, e.name, e.id as employee_id from office.hr_advance a join office.hr_employee e on e.id = a.employee_id where a.restaurante_id = $1 and a.date between $2::date and $3::date order by a.date desc`, [req.me!.rid, `${month}-01`, monthEnd(month)]);
  res.json(rows.map((r) => ({ id: r.id, date: r.date, amount: n(r.amount), method: r.method, note: r.note, employee: r.name, employeeId: r.employee_id })));
}));

router.post('/hr/advances', need('hr.write'), ah(async (req, res) => {
  const b = parse(z.object({ employeeId: z.string().min(1), date: isoDate, amount: z.number({ invalid_type_error: 'Сумма должна быть числом' }).positive('Сумма должна быть больше нуля').max(1e10), method: z.string().trim().max(30).nullish(), note: z.string().trim().max(200).nullish() }), req.body);
  const rid = req.me!.rid;
  const e = await q1<{ name: string }>('select name from office.hr_employee where id = $1 and restaurante_id = $2', [b.employeeId, rid]);
  if (!e) throw new HttpError(404, 'Сотрудник не найден');
  const locked = await q1(`select 1 from office.hr_payroll where restaurante_id = $1 and period = $2 and status in ('approved', 'paid')`, [rid, b.date.slice(0, 7)]);
  if (locked) throw new HttpError(409, 'Ведомость за этот месяц утверждена — аванс добавить нельзя');
  const cat = await categoryOf(rid, 'payroll');
  const id = await tx(async (c) => {
    const a = (await c.query('insert into office.hr_advance (restaurante_id, employee_id, date, amount, method, note, created_by_name) values ($1,$2,$3,$4,$5,$6,$7) returning id', [rid, b.employeeId, b.date, b.amount, b.method ?? null, b.note ?? null, req.me!.name])).rows[0];
    const ex = (await c.query(`insert into office.expense (restaurante_id, date, category_id, amount, description, counterparty, method, status, created_by, source, source_id) values ($1,$2,$3,$4,$5,$6,$7,'paid',$8,'advance',$9) returning id`,
      [rid, b.date, cat, b.amount, `Аванс: ${e.name}`, e.name, b.method ?? null, req.me!.name, a.id])).rows[0];
    await c.query('update office.hr_advance set expense_id = $2 where id = $1', [a.id, ex.id]);
    return a.id as string;
  });
  await audit(req, 'advance.create', 'advance', id, { employee: e.name, amount: b.amount });
  res.status(201).json({ id });
}));

router.delete('/hr/advances/:id', need('hr.write'), ah(async (req, res) => {
  const a = await q1<{ date: string; expense_id: string | null }>('select date, expense_id from office.hr_advance where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!a) throw new HttpError(404, 'Аванс не найден');
  const locked = await q1(`select 1 from office.hr_payroll where restaurante_id = $1 and period = $2 and status in ('approved', 'paid')`, [req.me!.rid, a.date.slice(0, 7)]);
  if (locked) throw new HttpError(409, 'Ведомость за этот месяц утверждена — аванс удалить нельзя');
  await tx(async (c) => { if (a.expense_id) await c.query('delete from office.expense where id = $1', [a.expense_id]); await c.query('delete from office.hr_advance where id = $1', [req.params.id]); });
  await audit(req, 'advance.delete', 'advance', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Ведомости ───────── */
interface Emp { id: string; name: string; position: string | null; pay_kind: string; rate: string; hire_date: string | null; fire_date: string | null }

/** Начисление по табелю: возвращает отработанные дни/часы и сумму по ставке. */
function accrue(e: Emp, norm: number, cells: { status: string; hours: number | null }[]) {
  const work = cells.filter((c) => c.status === 'work');
  const days = work.length, hours = round2(work.reduce((s, c) => s + (c.hours ?? 8), 0));
  const rate = n(e.rate);
  const base = e.pay_kind === 'salary' ? (norm > 0 ? rate * Math.min(1, days / norm) : 0) : e.pay_kind === 'hourly' ? rate * hours : rate * days;
  return { days, hours, base: round2(base) };
}

async function computeLines(rid: string, period: string, norm: number) {
  const from = `${period}-01`, to = monthEnd(period);
  const emps = await q<Emp>(`select id, name, position, pay_kind, rate, hire_date, fire_date from office.hr_employee where restaurante_id = $1 and (hire_date is null or hire_date <= $3::date) and (fire_date is null or fire_date >= $2::date) and (active or exists(select 1 from office.hr_timesheet t where t.employee_id = hr_employee.id and t.date between $2::date and $3::date)) order by lower(name)`, [rid, from, to]);
  const cells = await q('select employee_id, status, hours from office.hr_timesheet where date between $1::date and $2::date', [from, to]);
  const adv = await q('select employee_id, sum(amount) as total from office.hr_advance where restaurante_id = $1 and date between $2::date and $3::date group by employee_id', [rid, from, to]);
  return emps.map((e) => {
    const a = accrue(e, norm, cells.filter((c) => c.employee_id === e.id).map((c) => ({ status: c.status, hours: c.hours === null ? null : n(c.hours) })));
    return { e, ...a, advance: n(adv.find((x) => x.employee_id === e.id)?.total) };
  });
}

router.get('/hr/payrolls', need('hr.view'), ah(async (req, res) => {
  const rows = await q(`select p.id, p.period, p.status, p.paid_date, p.deduction_pct, p.employer_pct, count(l.*)::int as lines,
                               coalesce(sum(l.base + l.bonus - l.penalty), 0) as gross, coalesce(sum(l.deduction), 0) as deduction, coalesce(sum(l.advance), 0) as advance
                          from office.hr_payroll p left join office.hr_payroll_line l on l.payroll_id = p.id where p.restaurante_id = $1 group by p.id order by p.period desc`, [req.me!.rid]);
  res.json(rows.map((r) => { const gross = n(r.gross); return { id: r.id, period: r.period, status: r.status, paidDate: r.paid_date, lines: r.lines, gross: round2(gross), deduction: round2(n(r.deduction)), advance: round2(n(r.advance)), net: round2(gross - n(r.deduction) - n(r.advance)), employer: round2(gross * n(r.employer_pct) / 100) }; }));
}));

async function loadPayroll(rid: string, id: string) {
  const p = await q1('select * from office.hr_payroll where id = $1 and restaurante_id = $2', [id, rid]);
  if (!p) throw new HttpError(404, 'Ведомость не найдена');
  const lines = await q('select * from office.hr_payroll_line where payroll_id = $1 order by lower(name)', [id]);
  const out = lines.map((l) => { const gross = n(l.base) + n(l.bonus) - n(l.penalty); return { employeeId: l.employee_id, name: l.name, position: l.position, payKind: l.pay_kind, payKindLabel: KIND_LABEL[l.pay_kind], rate: n(l.rate), workedDays: n(l.worked_days), workedHours: n(l.worked_hours), base: n(l.base), bonus: n(l.bonus), penalty: n(l.penalty), gross: round2(gross), advance: n(l.advance), deduction: n(l.deduction), net: round2(gross - n(l.deduction) - n(l.advance)), note: l.note }; });
  const sum = (k: 'gross' | 'deduction' | 'advance' | 'net') => round2(out.reduce((s, l) => s + l[k], 0));
  const gross = sum('gross');
  return { id: p.id, period: p.period, status: p.status, normDays: p.norm_days, deductionPct: n(p.deduction_pct), employerPct: n(p.employer_pct), note: p.note, paidDate: p.paid_date, createdBy: p.created_by_name,
    lines: out, totals: { gross, deduction: sum('deduction'), advance: sum('advance'), net: sum('net'), employer: round2(gross * n(p.employer_pct) / 100) } };
}

router.get('/hr/payrolls/:id', need('hr.view'), ah(async (req, res) => { res.json(await loadPayroll(req.me!.rid, req.params.id)); }));

router.post('/hr/payrolls', need('hr.write'), ah(async (req, res) => {
  const b = parse(z.object({ period: monthParam, normDays: z.number().int().min(1).max(31).optional(), deductionPct: z.number().min(0).max(100).optional(), employerPct: z.number().min(0).max(100).optional() }), req.body);
  const rid = req.me!.rid;
  const dup = await q1('select 1 from office.hr_payroll where restaurante_id = $1 and period = $2', [rid, b.period]);
  if (dup) throw new HttpError(409, 'Ведомость за этот месяц уже есть');
  // ставки берём из прошлой ведомости — бухгалтеру не нужно вводить их заново
  const last = await q1<{ deduction_pct: string; employer_pct: string }>('select deduction_pct, employer_pct from office.hr_payroll where restaurante_id = $1 order by period desc limit 1', [rid]);
  const norm = b.normDays ?? normDaysOf(b.period), dpct = b.deductionPct ?? n(last?.deduction_pct), epct = b.employerPct ?? n(last?.employer_pct);
  const lines = await computeLines(rid, b.period, norm);
  if (!lines.length) throw new HttpError(409, 'В штате нет сотрудников на этот месяц');
  const id = await tx(async (c) => {
    const p = (await c.query('insert into office.hr_payroll (restaurante_id, period, norm_days, deduction_pct, employer_pct, created_by_name) values ($1,$2,$3,$4,$5,$6) returning id', [rid, b.period, norm, dpct, epct, req.me!.name])).rows[0];
    for (const l of lines) {
      await c.query('insert into office.hr_payroll_line (payroll_id, employee_id, name, position, pay_kind, rate, worked_days, worked_hours, base, advance, deduction) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [p.id, l.e.id, l.e.name, l.e.position, l.e.pay_kind, n(l.e.rate), l.days, l.hours, l.base, l.advance, round2(l.base * dpct / 100)]);
    }
    return p.id as string;
  });
  await audit(req, 'payroll.create', 'payroll', id, { period: b.period, lines: lines.length });
  res.status(201).json({ id });
}));

/** Пересчёт черновика по табелю и авансам; премии, штрафы и заметки сохраняются. */
router.post('/hr/payrolls/:id/recalc', need('hr.write'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const p = await loadPayroll(rid, req.params.id);
  if (p.status !== 'draft') throw new HttpError(409, 'Ведомость уже утверждена');
  const lines = await computeLines(rid, p.period, p.normDays);
  await tx(async (c) => {
    const keep = new Map(p.lines.map((l) => [l.employeeId, l]));
    await c.query('delete from office.hr_payroll_line where payroll_id = $1', [p.id]);
    for (const l of lines) {
      const old = keep.get(l.e.id);
      await c.query('insert into office.hr_payroll_line (payroll_id, employee_id, name, position, pay_kind, rate, worked_days, worked_hours, base, bonus, penalty, advance, deduction, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
        [p.id, l.e.id, l.e.name, l.e.position, l.e.pay_kind, n(l.e.rate), l.days, l.hours, l.base, old?.bonus ?? 0, old?.penalty ?? 0, l.advance, round2((l.base + (old?.bonus ?? 0) - (old?.penalty ?? 0)) * p.deductionPct / 100), old?.note ?? null]);
    }
  });
  await audit(req, 'payroll.recalc', 'payroll', p.id);
  res.json(await loadPayroll(rid, p.id));
}));

router.put('/hr/payrolls/:id', need('hr.write'), ah(async (req, res) => {
  const b = parse(z.object({
    deductionPct: z.number().min(0).max(100).optional(), employerPct: z.number().min(0).max(100).optional(), normDays: z.number().int().min(1).max(31).optional(), note: z.string().trim().max(300).nullish(),
    lines: z.array(z.object({ employeeId: z.string(), base: z.number().min(0).max(1e10).optional(), bonus: z.number().min(0).max(1e10), penalty: z.number().min(0).max(1e10), note: z.string().trim().max(200).nullish() })).max(500).optional(),
  }), req.body);
  const rid = req.me!.rid;
  const p = await loadPayroll(rid, req.params.id);
  if (p.status !== 'draft') throw new HttpError(409, 'Ведомость утверждена — сначала верните её в черновик');
  const dpct = b.deductionPct ?? p.deductionPct;
  await tx(async (c) => {
    await c.query('update office.hr_payroll set deduction_pct = $2, employer_pct = coalesce($3, employer_pct), norm_days = coalesce($4, norm_days), note = case when $5::boolean then $6 else note end where id = $1', [p.id, dpct, b.employerPct ?? null, b.normDays ?? null, b.note !== undefined, b.note ?? null]);
    const edits = new Map((b.lines ?? []).map((l) => [l.employeeId, l]));
    for (const l of p.lines) {
      const e = edits.get(l.employeeId);
      const base = e?.base ?? l.base, bonus = e?.bonus ?? l.bonus, penalty = e?.penalty ?? l.penalty;
      if (penalty > base + bonus) throw new HttpError(400, `Штраф больше начисления: ${l.name}`);
      await c.query('update office.hr_payroll_line set base = $3, bonus = $4, penalty = $5, deduction = $6, note = case when $7::boolean then $8 else note end where payroll_id = $1 and employee_id = $2', [p.id, l.employeeId, base, bonus, penalty, round2((base + bonus - penalty) * dpct / 100), e !== undefined, e?.note ?? null]);
    }
  });
  await audit(req, 'payroll.update', 'payroll', p.id);
  res.json(await loadPayroll(rid, p.id));
}));

router.post('/hr/payrolls/:id/approve', need('hr.write'), ah(async (req, res) => {
  const p = await loadPayroll(req.me!.rid, req.params.id);
  if (p.status !== 'draft') throw new HttpError(409, 'Ведомость уже утверждена');
  const neg = p.lines.find((l) => l.net < -0.005);
  if (neg) throw new HttpError(409, `У сотрудника «${neg.name}» авансы больше начисления — проверьте ведомость`);
  await q(`update office.hr_payroll set status = 'approved' where id = $1`, [p.id]);
  await audit(req, 'payroll.approve', 'payroll', p.id);
  res.json({ ok: true });
}));

router.post('/hr/payrolls/:id/reopen', need('hr.write'), ah(async (req, res) => {
  const p = await loadPayroll(req.me!.rid, req.params.id);
  if (p.status === 'paid') throw new HttpError(409, 'Ведомость уже выплачена — сначала отмените выплату');
  await q(`update office.hr_payroll set status = 'draft' where id = $1`, [p.id]);
  await audit(req, 'payroll.reopen', 'payroll', p.id);
  res.json({ ok: true });
}));

/** Выплата: расход «Зарплата» на сумму к выдаче и расход «Налоги и взносы» (к оплате) на удержания и взносы работодателя. */
router.post('/hr/payrolls/:id/pay', need('hr.write'), ah(async (req, res) => {
  const b = parse(z.object({ date: isoDate, method: z.string().trim().max(30).nullish() }), req.body);
  const rid = req.me!.rid;
  const p = await loadPayroll(rid, req.params.id);
  if (p.status !== 'approved') throw new HttpError(409, p.status === 'paid' ? 'Ведомость уже выплачена' : 'Сначала утвердите ведомость');
  const salaryCat = await categoryOf(rid, 'payroll');
  const taxAmount = round2(p.totals.deduction + p.totals.employer);
  const taxCat = taxAmount > 0 ? await categoryOf(rid, 'tax') : null;
  await tx(async (c) => {
    let first: string | null = null;
    if (p.totals.net > 0) {
      const ex = (await c.query(`insert into office.expense (restaurante_id, date, category_id, amount, description, doc_number, method, status, created_by, source, source_id) values ($1,$2,$3,$4,$5,$6,$7,'paid',$8,'payroll',$9) returning id`,
        [rid, b.date, salaryCat, p.totals.net, `Зарплата за ${p.period} (к выдаче)`, `Ведомость ${p.period}`, b.method ?? null, req.me!.name, p.id])).rows[0];
      first = ex.id;
    }
    if (taxCat) {
      await c.query(`insert into office.expense (restaurante_id, date, category_id, amount, description, doc_number, status, created_by, source, source_id) values ($1,$2,$3,$4,$5,$6,'pending',$7,'payroll',$8)`,
        [rid, b.date, taxCat, taxAmount, `Удержания и взносы с зарплаты за ${p.period}`, `Ведомость ${p.period}`, req.me!.name, p.id]);
    }
    await c.query(`update office.hr_payroll set status = 'paid', paid_date = $2, expense_id = $3 where id = $1`, [p.id, b.date, first]);
  });
  await audit(req, 'payroll.pay', 'payroll', p.id, { net: p.totals.net, tax: taxAmount });
  res.json({ ok: true, net: p.totals.net, tax: taxAmount });
}));

router.post('/hr/payrolls/:id/unpay', need('hr.write'), ah(async (req, res) => {
  const p = await loadPayroll(req.me!.rid, req.params.id);
  if (p.status !== 'paid') throw new HttpError(409, 'Ведомость не выплачена');
  await tx(async (c) => {
    await c.query(`delete from office.expense where source = 'payroll' and source_id = $1`, [p.id]);
    await c.query(`update office.hr_payroll set status = 'approved', paid_date = null, expense_id = null where id = $1`, [p.id]);
  });
  await audit(req, 'payroll.unpay', 'payroll', p.id);
  res.json({ ok: true });
}));

router.delete('/hr/payrolls/:id', need('hr.write'), ah(async (req, res) => {
  const p = await loadPayroll(req.me!.rid, req.params.id);
  if (p.status !== 'draft') throw new HttpError(409, 'Удалить можно только черновик');
  await q('delete from office.hr_payroll where id = $1', [p.id]);
  await audit(req, 'payroll.delete', 'payroll', p.id);
  res.json({ ok: true });
}));
