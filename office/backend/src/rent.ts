import { q, q1 } from './db';
import { addDays, n, round2 } from './util';

/**
 * Арендная ставка точки меняется во времени (индексация, новый договор). Расчёты за прошлые периоды должны считаться
 * по ставке, действовавшей в каждый день, поэтому ставки хранятся с датой начала действия.
 */
export interface RentRow { effective_from: string; rent_monthly: string }

export async function loadRentHistory(rid: string): Promise<Map<string, RentRow[]>> {
  const rows = await q<RentRow & { outlet_id: string }>('select outlet_id, effective_from, rent_monthly from office.outlet_rent_history where restaurante_id = $1 order by effective_from', [rid]);
  const m = new Map<string, RentRow[]>();
  for (const r of rows) (m.get(r.outlet_id) ?? m.set(r.outlet_id, []).get(r.outlet_id)!).push(r);
  return m;
}

function rentAt(hist: RentRow[], day: string): number {
  let cur = n(hist[0].rent_monthly);
  for (const h of hist) { if (h.effective_from <= day) cur = n(h.rent_monthly); else break; }
  return cur;
}

/** Аренда за период: сумма по дням (ставка дня / дней в месяце), только в пределах срока работы точки. */
export function rentFor(o: { rent_monthly: unknown; start_date?: string | null; end_date?: string | null }, hist: RentRow[] | undefined, from: string, to: string): number {
  let sum = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if ((o.start_date && d < o.start_date) || (o.end_date && d > o.end_date)) continue;
    const [y, m] = d.split('-').map(Number);
    const rate = hist && hist.length ? rentAt(hist, d) : n(o.rent_monthly);
    sum += rate / new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  return round2(sum);
}

/** Новая ставка с даты `effective`. При первом изменении сохраняется прежняя ставка как исходная. Возвращает true, если ставка изменилась. */
export async function setRent(rid: string, outletId: string, oldRent: number, newRent: number, effective: string, reason: string, who: string): Promise<boolean> {
  if (Math.abs(oldRent - newRent) < 0.005) return false;
  const has = await q1('select 1 from office.outlet_rent_history where outlet_id = $1 limit 1', [outletId]);
  if (!has) await q(`insert into office.outlet_rent_history (restaurante_id, outlet_id, effective_from, rent_monthly, reason, created_by_name) values ($1,$2,'2000-01-01',$3,'Исходная ставка','система') on conflict do nothing`, [rid, outletId, oldRent]);
  await q(`insert into office.outlet_rent_history (restaurante_id, outlet_id, effective_from, rent_monthly, reason, created_by_name) values ($1,$2,$3,$4,$5,$6)
           on conflict (outlet_id, effective_from) do update set rent_monthly = excluded.rent_monthly, reason = excluded.reason, created_by_name = excluded.created_by_name`, [rid, outletId, effective, newRent, reason, who]);
  await q('update office.outlet set rent_monthly = $2 where id = $1', [outletId, newRent]);
  return true;
}
