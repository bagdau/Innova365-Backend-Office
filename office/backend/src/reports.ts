import { q } from './db';
import { memo } from './cache';
import { loadModel } from './cost';
import { n, round2 } from './util';

/**
 * Общие отчётные запросы. Продажей считается заказ в статусе PAGADO; датой — момент оплаты (actualizadoEn),
 * переведённый в часовой пояс ресторана (в БД время хранится в UTC).
 */
export const payDate = `(p."actualizadoEn" at time zone 'UTC' at time zone $2)::date`;
/**
 * Фильтр «оплачено в период $from..$to (включительно) по местному времени» в виде диапазона по самому столбцу, а не вычислением над ним:
 * так PostgreSQL использует индекс по дате оплаты и отчёты остаются быстрыми при сотнях тысяч заказов.
 */
export const payBetween = (from = '$3', to = '$4') =>
  `(p."actualizadoEn" >= ((${from}::date)::timestamp at time zone $2) at time zone 'UTC' and p."actualizadoEn" < ((${to}::date + 1)::timestamp at time zone $2) at time zone 'UTC')`;

const METHOD_NAMES: Record<string, string> = { Efectivo: 'Наличные', Tarjeta: 'Карта', QR: 'QR', Transferencia: 'Перевод' };
export const methodLabel = (m: string | null) => (m ? METHOD_NAMES[m] ?? m : 'Не указан');

export interface RevenueDay { date: string; orders: number; revenue: number; cash: number; card: number; qr: number; transfer: number; other: number }

/** Выручка по дням с разбивкой по способам оплаты. */
export const revenueByDay = (rid: string, tz: string, from: string, to: string) => memo(`days|${rid}|${tz}|${from}|${to}`, () => revenueByDayRaw(rid, tz, from, to));
async function revenueByDayRaw(rid: string, tz: string, from: string, to: string): Promise<RevenueDay[]> {
  const rows = await q(
    `select ${payDate} as d, count(*)::int as orders,
            coalesce(sum(p.total), 0) as revenue,
            coalesce(sum(p.total) filter (where p."metodoPago" = 'Efectivo'), 0) as cash,
            coalesce(sum(p.total) filter (where p."metodoPago" = 'Tarjeta'), 0) as card,
            coalesce(sum(p.total) filter (where p."metodoPago" = 'QR'), 0) as qr,
            coalesce(sum(p.total) filter (where p."metodoPago" = 'Transferencia'), 0) as transfer,
            coalesce(sum(p.total) filter (where p."metodoPago" is null or p."metodoPago" not in ('Efectivo','Tarjeta','QR','Transferencia')), 0) as other
       from public."Pedido" p
      where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()}
      group by 1 order by 1`, [rid, tz, from, to]);
  return rows.map((r) => ({ date: r.d, orders: r.orders, revenue: n(r.revenue), cash: n(r.cash), card: n(r.card), qr: n(r.qr), transfer: n(r.transfer), other: n(r.other) }));
}

export const sumDays = (rows: RevenueDay[]) => rows.reduce((a, r) => ({
  orders: a.orders + r.orders, revenue: a.revenue + r.revenue, cash: a.cash + r.cash, card: a.card + r.card, qr: a.qr + r.qr, transfer: a.transfer + r.transfer, other: a.other + r.other,
}), { orders: 0, revenue: 0, cash: 0, card: 0, qr: 0, transfer: 0, other: 0 });

/** Проданные блюда за период. */
export const soldProducts = (rid: string, tz: string, from: string, to: string) => memo(`sold|${rid}|${tz}|${from}|${to}`, () => soldProductsRaw(rid, tz, from, to));
async function soldProductsRaw(rid: string, tz: string, from: string, to: string) {
  const rows = await q(
    `select ip."productoId" as id, sum(ip.cantidad)::int as qty, sum(ip.subtotal) as revenue
       from public."ItemPedido" ip join public."Pedido" p on p.id = ip."pedidoId"
      where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()}
      group by 1`, [rid, tz, from, to]);
  return rows.map((r) => ({ id: r.id as string, qty: r.qty as number, revenue: n(r.revenue) }));
}

/** Себестоимость проданного по тех-картам + число позиций без тех-карты / с неполной ценой сырья. */
export async function cogs(rid: string, tz: string, from: string, to: string) {
  const [model, sold] = await Promise.all([loadModel(rid), soldProducts(rid, tz, from, to)]);
  let total = 0, noCard = 0, incomplete = 0, noCardRevenue = 0;
  const byProduct: { id: string; nombre: string; qty: number; revenue: number; cost: number | null }[] = [];
  for (const s of sold) {
    const c = model.costOf(s.id);
    const p = model.productos.get(s.id);
    if (!c.hasCard) { noCard += s.qty; noCardRevenue += s.revenue; byProduct.push({ id: s.id, nombre: p?.nombre ?? '—', qty: s.qty, revenue: s.revenue, cost: null }); continue; }
    if (c.incompleto) incomplete += s.qty;
    total += c.costo * s.qty;
    byProduct.push({ id: s.id, nombre: p?.nombre ?? '—', qty: s.qty, revenue: s.revenue, cost: round2(c.costo * s.qty) });
  }
  return { total: round2(total), noCard, noCardRevenue: round2(noCardRevenue), incomplete, byProduct };
}

/** Выручка по категориям меню — из продаж по блюдам (без отдельного прохода по заказам). */
export async function revenueByCategory(rid: string, tz: string, from: string, to: string) {
  const [sold, prods, cats] = await Promise.all([
    soldProducts(rid, tz, from, to),
    memo(`prod-cat|${rid}`, () => q('select id, "categoriaId" as cat from public."Producto" where "restauranteId" = $1', [rid])),
    memo(`cats|${rid}`, () => q('select id, nombre from public."Categoria" where "restauranteId" = $1', [rid])),
  ]);
  const catOf = new Map((prods as { id: string; cat: string }[]).map((p) => [p.id, p.cat]));
  const name = new Map((cats as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]));
  const acc = new Map<string, { id: string; nombre: string; qty: number; revenue: number }>();
  for (const x of sold) {
    const c = catOf.get(x.id);
    if (!c || !name.has(c)) continue;
    const cur = acc.get(c) ?? { id: c, nombre: name.get(c)!, qty: 0, revenue: 0 };
    cur.qty += x.qty; cur.revenue += x.revenue;
    acc.set(c, cur);
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Выручка по точкам фудкорта (по категориям меню, закреплённым за точкой). outlet_id = null — категории без точки. */
export const revenueByOutlet = (rid: string, tz: string, from: string, to: string) => memo(`outlet|${rid}|${tz}|${from}|${to}`, () => revenueByOutletRaw(rid, tz, from, to));
async function revenueByOutletRaw(rid: string, tz: string, from: string, to: string) {
  // сначала свёртка до (заказ, точка) — хеш-агрегация вместо медленного count(distinct) с сортировкой
  const rows = await q(
    `select t.outlet_id, count(*)::int as orders, coalesce(sum(t.qty), 0)::int as qty, coalesce(sum(t.rev), 0) as revenue
       from (select oc.outlet_id, sum(ip.cantidad) as qty, sum(ip.subtotal) as rev
               from public."ItemPedido" ip join public."Pedido" p on p.id = ip."pedidoId"
               join public."Producto" pr on pr.id = ip."productoId"
               left join office.outlet_category oc on oc.categoria_id = pr."categoriaId" and oc.restaurante_id = p."restauranteId"
              where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()}
              group by p.id, oc.outlet_id) t
      group by t.outlet_id`, [rid, tz, from, to]);
  return rows.map((r) => ({ outletId: (r.outlet_id as string | null), orders: r.orders as number, qty: r.qty as number, revenue: n(r.revenue) }));
}
