import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { q, q1 } from '../db';
import { setRent } from '../rent';
import { addDays, ah, daysBetween, HttpError, isoDate, n, parse, round2, todayIso } from '../util';

/**
 * Договоры аренды. Условия действующего договора (ставка, комиссия, сроки) автоматически попадают в карточку точки,
 * а изменения арендной ставки записываются в историю — расчёты за прошлые периоды остаются верными.
 */
export const router = Router();
router.use('/fc/leases', auth);

const body = z.object({
  outletId: z.string().min(1, 'Выберите точку'), number: z.string().trim().min(1, 'Укажите номер договора').max(40), signedDate: isoDate.nullish(),
  startDate: isoDate, endDate: isoDate.nullish(), rentMonthly: z.number({ invalid_type_error: 'Аренда должна быть числом' }).min(0).max(1e10),
  commissionPct: z.number().min(0, 'Процент от 0 до 100').max(100, 'Процент от 0 до 100'), deposit: z.number().min(0).max(1e10).default(0), depositPaid: z.boolean().default(false),
  paymentDay: z.number().int().min(1).max(31).nullish(), indexationPct: z.number().min(0).max(100).default(0), indexationMonth: z.number().int().min(1).max(12).nullish(),
  noticeDays: z.number().int().min(0).max(365).default(30), status: z.enum(['draft', 'active', 'ended', 'terminated']).default('active'), notes: z.string().trim().max(1000).nullish(),
});

const out = (l: any, today: string) => {
  const daysLeft = l.end_date ? daysBetween(today, l.end_date) : null;
  const active = l.status === 'active';
  return {
    id: l.id, outletId: l.outlet_id, outletName: l.outlet_name, number: l.number, signedDate: l.signed_date, startDate: l.start_date, endDate: l.end_date, rentMonthly: n(l.rent_monthly), commissionPct: n(l.commission_pct),
    deposit: n(l.deposit), depositPaid: l.deposit_paid, paymentDay: l.payment_day, indexationPct: n(l.indexation_pct), indexationMonth: l.indexation_month, noticeDays: l.notice_days, status: l.status, notes: l.notes,
    daysLeft, expiring: active && daysLeft !== null && daysLeft >= 0 && daysLeft <= l.notice_days, overdueEnd: active && daysLeft !== null && daysLeft < 0,
  };
};

router.get('/fc/leases', need('fc.view'), ah(async (req, res) => {
  const tz = (await getSettings(req.me!.rid)).timezone;
  const outletId = typeof req.query.outletId === 'string' && req.query.outletId ? req.query.outletId : null;
  const rows = await q(`select l.*, o.name as outlet_name from office.lease l join office.outlet o on o.id = l.outlet_id where l.restaurante_id = $1 and ($2::text is null or l.outlet_id = $2) order by (l.status = 'active') desc, l.start_date desc`, [req.me!.rid, outletId]);
  const today = todayIso(tz);
  res.json(rows.map((l) => out(l, today)));
}));

router.get('/fc/leases/:id', need('fc.view'), ah(async (req, res) => {
  const tz = (await getSettings(req.me!.rid)).timezone;
  const l = await q1('select l.*, o.name as outlet_name from office.lease l join office.outlet o on o.id = l.outlet_id where l.id = $1 and l.restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!l) throw new HttpError(404, 'Договор не найден');
  const hist = await q('select effective_from, rent_monthly, reason, created_by_name from office.outlet_rent_history where outlet_id = $1 order by effective_from desc', [l.outlet_id]);
  res.json({ ...out(l, todayIso(tz)), rentHistory: hist.map((h) => ({ from: h.effective_from, rent: n(h.rent_monthly), reason: h.reason, who: h.created_by_name })) });
}));

/** Условия действующего договора переносятся в карточку точки; изменение ставки попадает в историю. */
async function syncOutlet(rid: string, b: z.infer<typeof body>, who: string) {
  const o = await q1<{ rent_monthly: string; start_date: string | null }>('select rent_monthly, start_date from office.outlet where id = $1 and restaurante_id = $2', [b.outletId, rid]);
  if (!o) throw new HttpError(400, 'Точка не найдена');
  // дата начала работы точки — самая ранняя из договоров: новый договор не «сдвигает» историю вперёд
  const start = o.start_date && o.start_date < b.startDate ? o.start_date : b.startDate;
  await q('update office.outlet set commission_pct = $2, start_date = $3, end_date = $4, status = case when status = \'closed\' then status else \'active\' end where id = $1', [b.outletId, b.commissionPct, start, b.endDate ?? null]);
  await setRent(rid, b.outletId, n(o.rent_monthly), b.rentMonthly, b.startDate,   // договор вступает в силу с даты начала
    `Договор №${b.number}`, who);
}

router.post('/fc/leases', need('fc.edit'), ah(async (req, res) => {
  const b = parse(body, req.body);
  const rid = req.me!.rid;
  if (b.endDate && b.endDate < b.startDate) throw new HttpError(400, 'Дата окончания раньше даты начала');
  const tz = (await getSettings(rid)).timezone;
  if (b.status === 'active') {
    const other = await q1<{ number: string }>(`select number from office.lease where outlet_id = $1 and status = 'active'`, [b.outletId]);
    if (other) throw new HttpError(409, `У точки уже есть действующий договор №${other.number} — завершите его или расторгните`);
  }
  const ok = await q1('select 1 from office.outlet where id = $1 and restaurante_id = $2', [b.outletId, rid]);
  if (!ok) throw new HttpError(400, 'Точка не найдена');
  const l = await q1<{ id: string }>(`insert into office.lease (restaurante_id, outlet_id, number, signed_date, start_date, end_date, rent_monthly, commission_pct, deposit, deposit_paid, payment_day, indexation_pct, indexation_month, notice_days, status, notes, created_by_name)
                                      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
    [rid, b.outletId, b.number, b.signedDate ?? null, b.startDate, b.endDate ?? null, b.rentMonthly, b.commissionPct, b.deposit, b.depositPaid, b.paymentDay ?? null, b.indexationPct, b.indexationMonth ?? null, b.noticeDays, b.status, b.notes ?? null, req.me!.name]);
  if (b.status === 'active') await syncOutlet(rid, b, req.me!.name);
  await audit(req, 'lease.create', 'lease', l!.id, { number: b.number, outletId: b.outletId, rent: b.rentMonthly });
  res.status(201).json({ id: l!.id });
}));

router.patch('/fc/leases/:id', need('fc.edit'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const cur = await q1('select * from office.lease where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!cur) throw new HttpError(404, 'Договор не найден');
  const patch = parse(body.partial(), req.body);
  const b = parse(body, {
    outletId: cur.outlet_id, number: cur.number, signedDate: cur.signed_date, startDate: cur.start_date, endDate: cur.end_date, rentMonthly: n(cur.rent_monthly), commissionPct: n(cur.commission_pct), deposit: n(cur.deposit),
    depositPaid: cur.deposit_paid, paymentDay: cur.payment_day, indexationPct: n(cur.indexation_pct), indexationMonth: cur.indexation_month, noticeDays: cur.notice_days, status: cur.status, notes: cur.notes, ...patch,
  });
  if (b.outletId !== cur.outlet_id) throw new HttpError(400, 'Точку договора менять нельзя');
  if (b.endDate && b.endDate < b.startDate) throw new HttpError(400, 'Дата окончания раньше даты начала');
  if (b.status === 'active' && cur.status !== 'active') {
    const other = await q1<{ number: string }>(`select number from office.lease where outlet_id = $1 and status = 'active' and id <> $2`, [b.outletId, cur.id]);
    if (other) throw new HttpError(409, `У точки уже есть действующий договор №${other.number}`);
  }
  await q(`update office.lease set number=$2, signed_date=$3, start_date=$4, end_date=$5, rent_monthly=$6, commission_pct=$7, deposit=$8, deposit_paid=$9, payment_day=$10, indexation_pct=$11, indexation_month=$12, notice_days=$13, status=$14, notes=$15 where id = $1`,
    [cur.id, b.number, b.signedDate ?? null, b.startDate, b.endDate ?? null, b.rentMonthly, b.commissionPct, b.deposit, b.depositPaid, b.paymentDay ?? null, b.indexationPct, b.indexationMonth ?? null, b.noticeDays, b.status, b.notes ?? null]);
  if (b.status === 'active') {
    const tz = (await getSettings(rid)).timezone;
    // ставку из карточки договора вводят уже действующей: меняем её с сегодняшнего дня, а не задним числом
    const o = await q1<{ rent_monthly: string; start_date: string | null }>('select rent_monthly, start_date from office.outlet where id = $1', [b.outletId]);
    await q('update office.outlet set commission_pct = $2, start_date = $3, end_date = $4 where id = $1', [b.outletId, b.commissionPct, o?.start_date && o.start_date < b.startDate ? o.start_date : b.startDate, b.endDate ?? null]);
    if (o && Math.abs(n(o.rent_monthly) - b.rentMonthly) >= 0.005) await setRent(rid, b.outletId, n(o.rent_monthly), b.rentMonthly, todayIso(tz), `Договор №${b.number} изменён`, req.me!.name);
  } else if (cur.status === 'active' && (b.status === 'ended' || b.status === 'terminated')) {
    const tz = (await getSettings(rid)).timezone;
    const endDate = b.endDate ?? cur.end_date ?? todayIso(tz);
    const o = await q1<{ rent_monthly: string }>('select rent_monthly from office.outlet where id = $1', [b.outletId]);
    await q('update office.outlet set end_date = $2 where id = $1', [b.outletId, endDate]);
    // после расторжения аренда не начисляется, пока не будет нового договора
    if (o) await setRent(rid, b.outletId, n(o.rent_monthly), 0, addDays(endDate, 1), `Договор №${b.number} завершён`, req.me!.name);
  }
  await audit(req, 'lease.update', 'lease', cur.id, patch);
  res.json({ ok: true });
}));

/** Индексация аренды: ставка растёт на процент с указанной даты, договор и карточка точки обновляются, история сохраняется. */
router.post('/fc/leases/:id/index', need('fc.edit'), ah(async (req, res) => {
  const b = parse(z.object({ pct: z.number().min(0.01, 'Процент должен быть больше нуля').max(100), from: isoDate, reason: z.string().trim().max(120).nullish() }), req.body);
  const rid = req.me!.rid;
  const l = await q1('select * from office.lease where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!l) throw new HttpError(404, 'Договор не найден');
  if (l.status !== 'active') throw new HttpError(409, 'Индексировать можно только действующий договор');
  const old = n(l.rent_monthly), next = round2(old * (1 + b.pct / 100));
  await q('update office.lease set rent_monthly = $2 where id = $1', [l.id, next]);
  await setRent(rid, l.outlet_id, old, next, b.from, b.reason || `Индексация +${b.pct}%`, req.me!.name);
  await audit(req, 'lease.index', 'lease', l.id, { pct: b.pct, from: b.from, old, next });
  res.json({ old, next });
}));

router.delete('/fc/leases/:id', need('fc.edit'), ah(async (req, res) => {
  const l = await q1<{ status: string }>('select status from office.lease where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!l) throw new HttpError(404, 'Договор не найден');
  if (l.status === 'active') throw new HttpError(409, 'Действующий договор удалить нельзя — завершите или расторгните его');
  await q('delete from office.lease where id = $1', [req.params.id]);
  await audit(req, 'lease.delete', 'lease', req.params.id);
  res.json({ ok: true });
}));
