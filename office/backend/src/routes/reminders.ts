import { Router } from 'express';
import { auth, getSettings, hasPerm } from '../auth';
import type { Me } from '../auth';
import { q, q1 } from '../db';
import { addDays, ah, daysBetween, n, todayIso } from '../util';

/**
 * «Требует внимания»: всё, что нельзя забыть. Собирается из разных разделов, каждому пользователю показывается
 * только то, к чему у него есть доступ. Используется на панели, в колокольчике и в уведомлениях Telegram.
 */
export const router = Router();
router.use('/reminders', auth);

export interface Reminder { id: string; kind: string; severity: 'bad' | 'warn' | 'info'; title: string; detail: string; link: string; date?: string | null }

const rub = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v));

export async function collectReminders(me: Pick<Me, 'rid' | 'role'> & { id?: string; src?: string; name?: string; email?: string }): Promise<Reminder[]> {
  const rid = me.rid;
  const s = await getSettings(rid);
  const today = todayIso(s.timezone);
  const can = (p: Parameters<typeof hasPerm>[1]) => hasPerm(me as Me, p);
  const out: Reminder[] = [];
  const jobs: Promise<void>[] = [];

  if (can('fc.view')) {
    jobs.push((async () => {
      const inv = await q(`select i.id, i.number, i.kind, i.due_date, i.total, o.name, (select coalesce(sum(p.amount), 0) from office.invoice_payment p where p.invoice_id = i.id) as paid
                             from office.invoice i join office.outlet o on o.id = i.outlet_id where i.restaurante_id = $1 and i.status = 'issued' and i.due_date is not null and i.due_date <= $2::date order by i.due_date`, [rid, addDays(today, 3)]);
      for (const i of inv) {
        const left = n(i.total) - n(i.paid);
        if (left <= 0.005) continue;
        const overdue = i.due_date < today;
        out.push({ id: 'inv:' + i.id, kind: 'invoice', severity: overdue ? 'bad' : 'warn', title: `${overdue ? 'Просрочен' : 'Скоро срок'}: ${i.kind === 'act' ? 'акт' : 'счёт'} №${i.number} — ${i.name}`, detail: `К оплате ${rub(left)}, срок ${i.due_date.split('-').reverse().join('.')}${overdue ? ` (просрочка ${daysBetween(i.due_date, today)} дн.)` : ''}`, link: `/foodcourt/invoices`, date: i.due_date });
      }
      const leases = await q(`select l.id, l.number, l.end_date, l.notice_days, l.indexation_pct, l.indexation_month, o.name,
                                     exists(select 1 from office.outlet_rent_history h where h.outlet_id = l.outlet_id and h.reason like 'Индексация%' and h.created_at > now() - interval '10 months') as indexed
                                from office.lease l join office.outlet o on o.id = l.outlet_id where l.restaurante_id = $1 and l.status = 'active'`, [rid]);
      for (const l of leases) {
        if (l.end_date) {
          const left = daysBetween(today, l.end_date);
          if (left < 0) out.push({ id: 'lease-end:' + l.id, kind: 'lease', severity: 'bad', title: `Договор №${l.number} с «${l.name}» истёк`, detail: `Срок закончился ${l.end_date.split('-').reverse().join('.')} — продлите или завершите договор`, link: '/foodcourt/leases', date: l.end_date });
          else if (left <= l.notice_days) out.push({ id: 'lease-end:' + l.id, kind: 'lease', severity: left <= 14 ? 'bad' : 'warn', title: `Договор №${l.number} с «${l.name}» заканчивается`, detail: `Осталось ${left} дн. (до ${l.end_date.split('-').reverse().join('.')})`, link: '/foodcourt/leases', date: l.end_date });
        }
        if (n(l.indexation_pct) > 0 && l.indexation_month === Number(today.slice(5, 7)) && !l.indexed) out.push({ id: 'lease-idx:' + l.id, kind: 'lease', severity: 'info', title: `Пора проиндексировать аренду: «${l.name}»`, detail: `По договору №${l.number} индексация ${n(l.indexation_pct)}% в этом месяце`, link: '/foodcourt/leases' });
      }
      const sets = await q(`select s.id, s.number, s.status, s.period_to, o.name, s.payable from office.settlement s join office.outlet o on o.id = s.outlet_id where s.restaurante_id = $1 and s.status = 'issued' and s.issued_at < now() - interval '7 days'`, [rid]);
      for (const x of sets) out.push({ id: 'st:' + x.id, kind: 'settlement', severity: 'warn', title: `Расчёт №${x.number} с «${x.name}» не закрыт больше недели`, detail: n(x.payable) >= 0 ? `К выплате арендатору ${rub(n(x.payable))}` : `К доплате арендатором ${rub(-n(x.payable))}`, link: `/foodcourt/settlements/${x.id}` });
    })());
  }

  if (can('acc.view')) {
    jobs.push((async () => {
      const e = await q1<{ c: number; t: string }>(`select count(*)::int as c, coalesce(sum(amount), 0) as t from office.expense where restaurante_id = $1 and status = 'pending' and date <= $2::date`, [rid, today]);
      if (e && e.c > 0) out.push({ id: 'exp-pending', kind: 'expense', severity: 'warn', title: `Расходы к оплате: ${e.c}`, detail: `На сумму ${rub(n(e.t))}`, link: '/accounting/expenses' });
    })());
  }

  if (can('sup.view')) {
    jobs.push((async () => {
      const rows = await q(`select p.nombre, x.debt from public."Proveedor" p join office.supplier_ext e on e.proveedor_id = p.id and e.payment_days is not null
                              join lateral (select coalesce(sum(greatest(0, rec - paid)), 0) as debt from (
                                select (select coalesce(sum(ri.cantidad * ri."costoUnitario"), 0) from public."RecepcionItem" ri join public."Recepcion" rc on rc.id = ri."recepcionId" where rc."compraId" = c.id) as rec,
                                       (select coalesce(sum(pp.amount), 0) from office.purchase_payment pp where pp.compra_id = c.id) as paid,
                                       (select max(rc."creadoEn") from public."Recepcion" rc where rc."compraId" = c.id) as last_rec
                                  from public."Compra" c where c."proveedorId" = p.id and c.estado <> 'CANCELADA') z
                                where z.last_rec is not null and (z.last_rec at time zone 'UTC' at time zone $2)::date + e.payment_days < $3::date) x on x.debt > 0
                             where p."restauranteId" = $1`, [rid, s.timezone, today]);
      for (const r of rows) out.push({ id: 'sup:' + r.nombre, kind: 'supplier', severity: 'bad', title: `Просрочен долг поставщику «${r.nombre}»`, detail: `Просрочено ${rub(n(r.debt))}`, link: '/suppliers' });
    })());
  }

  if (can('hr.view')) {
    jobs.push((async () => {
      const ap = await q(`select period from office.hr_payroll where restaurante_id = $1 and status = 'approved'`, [rid]);
      for (const p of ap) out.push({ id: 'pay:' + p.period, kind: 'payroll', severity: 'warn', title: `Ведомость за ${p.period} утверждена, но не выплачена`, detail: 'Проведите выплату, чтобы расходы попали в учёт', link: '/hr/payroll' });
      const prev = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
      if (Number(today.slice(8)) >= 5) {
        const has = await q1('select 1 from office.hr_payroll where restaurante_id = $1 and period = $2', [rid, prev]);
        const staff = await q1<{ c: number }>('select count(*)::int as c from office.hr_employee where restaurante_id = $1 and active', [rid]);
        if (!has && staff && staff.c > 0) out.push({ id: 'pay-missing:' + prev, kind: 'payroll', severity: 'info', title: `Нет ведомости за ${prev}`, detail: 'Заполните табель и создайте ведомость', link: '/hr/payroll' });
      }
    })());
  }

  if (can('tc.approve')) {
    jobs.push((async () => {
      const r = await q1<{ c: number }>(`select count(*)::int as c from office.tc_state where restaurante_id = $1 and status = 'review'`, [rid]);
      if (r && r.c > 0) out.push({ id: 'tc-review', kind: 'techcard', severity: 'info', title: `Техкарты ждут согласования: ${r.c}`, detail: 'Откройте «Техкарты» и отфильтруйте по статусу «На согласовании»', link: '/techcards' });
    })());
  }

  if (can('inv.view')) {
    jobs.push((async () => {
      const r = await q1<{ out: number; low: number }>(`select count(*) filter (where "stockActual" <= 0)::int as out, count(*) filter (where "stockActual" > 0 and "stockActual" <= "stockMinimo")::int as low from public."Insumo" where "restauranteId" = $1`, [rid]);
      if (r && r.out > 0) out.push({ id: 'stock-out', kind: 'stock', severity: 'bad', title: `Нет в наличии: ${r.out} поз. сырья`, detail: r.low ? `И ещё ${r.low} ниже минимума` : 'Проверьте остатки и закажите', link: '/inventory/stock' });
      else if (r && r.low > 0) out.push({ id: 'stock-low', kind: 'stock', severity: 'warn', title: `Ниже минимума: ${r.low} поз. сырья`, detail: 'Откройте «Остатки и заказ» — там рекомендации к закупке', link: '/inventory/stock' });
      const st = await q1<{ number: number; created_at: string }>(`select number, created_at from office.stocktake where restaurante_id = $1 and status = 'draft' and created_at < now() - interval '3 days' limit 1`, [rid]);
      if (st) out.push({ id: 'stocktake-open', kind: 'stock', severity: 'info', title: `Инвентаризация №${st.number} не завершена`, detail: 'Подсчёт идёт больше трёх дней — закройте или отмените его', link: '/inventory/stocktakes' });
    })());
  }

  if (can('sys.view') || can('sys.backup')) {
    jobs.push((async () => {
      const b = await q1<{ created_at: string }>(`select created_at from office.backup where restaurante_id = $1 and status = 'ok' order by created_at desc limit 1`, [rid]);
      const age = b ? (Date.now() - new Date(b.created_at).getTime()) / 3600_000 : null;
      if (age === null) out.push({ id: 'backup', kind: 'system', severity: 'bad', title: 'Резервных копий базы ещё нет', detail: 'Создайте первую копию в разделе «Система»', link: '/admin/system' });
      else if (age > 36) out.push({ id: 'backup', kind: 'system', severity: age > 72 ? 'bad' : 'warn', title: 'Давно не делалась резервная копия', detail: `Последняя — ${Math.round(age)} ч назад`, link: '/admin/system' });
    })());
  }

  await Promise.all(jobs);
  const order = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || (a.date ?? '9').localeCompare(b.date ?? '9'));
}

router.get('/reminders', ah(async (req, res) => {
  const list = await collectReminders(req.me!);
  res.json({ rows: list, bad: list.filter((r) => r.severity === 'bad').length, total: list.length });
}));
