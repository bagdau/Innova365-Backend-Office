export interface DailySalesRow { fecha: string; ventas: number; pedidos: number }

function localDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Добавляет календарные дни без оплаченных заказов для непрерывной оси графика. */
export function fillDailySales(rows: DailySalesRow[], from: Date, to: Date, timeZone: string): DailySalesRow[] {
  const byDay = new Map(rows.map((row) => [row.fecha, row]));
  const start = localDay(from, timeZone);
  const end = localDay(to, timeZone);
  const day = new Date(`${start}T00:00:00.000Z`);
  const result: DailySalesRow[] = [];
  while (day.toISOString().slice(0, 10) <= end) {
    const fecha = day.toISOString().slice(0, 10);
    result.push(byDay.get(fecha) ?? { fecha, ventas: 0, pedidos: 0 });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}
