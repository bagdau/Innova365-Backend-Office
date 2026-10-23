import { Router } from 'express';
import { auth, getSettings, need } from '../auth';
import { q } from '../db';
import { ah, n, periodOf, round2 } from '../util';

/**
 * Контроль сотрудников зала и кассы: заказы, выручка, средний чек, отмены (в том числе после того, как блюдо уже готово).
 * Период считается по дате создания заказа в часовом поясе ресторана. Скидок в кассе нет, поэтому главный риск — отмены.
 */
export const router = Router();
router.use('/ctl', auth);

const range = `p."creadoEn" >= (($2::date)::timestamp at time zone $4) at time zone 'UTC' and p."creadoEn" < (($3::date + 1)::timestamp at time zone $4) at time zone 'UTC'`;
const itemsSum = `(select coalesce(sum(ip.subtotal), 0) from public."ItemPedido" ip where ip."pedidoId" = p.id)`;

router.get('/ctl/staff', need('ctl.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const rows = await q(
    `select u.id, u.nombre, u.rol::text as rol, u.activo,
            count(*)::int as orders,
            count(*) filter (where p.estado = 'PAGADO')::int as paid,
            coalesce(sum(p.total) filter (where p.estado = 'PAGADO'), 0) as revenue,
            count(*) filter (where p.estado = 'PAGADO' and p."metodoPago" = 'Efectivo')::int as cash,
            count(*) filter (where p.estado = 'CANCELADO')::int as cancelled,
            coalesce(sum(${itemsSum}) filter (where p.estado = 'CANCELADO'), 0) as cancelled_amount,
            count(*) filter (where p.estado = 'CANCELADO' and p."tiempoListo" is not null)::int as cancelled_ready
       from public."Pedido" p join public."Usuario" u on u.id = p."meseroId"
      where p."restauranteId" = $1 and ${range} group by u.id order by revenue desc`, [rid, from, to, s.timezone]);
  // кто нажал «отменить» — из журнала кассы (может быть не тот, кто принимал заказ)
  const actors = await q(
    `select a."usuarioId" as id, count(*)::int as cnt from public."RegistroActividad" a
      where a."restauranteId" = $1 and a.accion = 'pedido.estado' and a.detalle = 'estado=CANCELADO'
        and a."creadoEn" >= (($2::date)::timestamp at time zone $4) at time zone 'UTC' and a."creadoEn" < (($3::date + 1)::timestamp at time zone $4) at time zone 'UTC' group by a."usuarioId"`, [rid, from, to, s.timezone]);
  const by = new Map(actors.map((a) => [a.id as string, a.cnt as number]));

  const totalOrders = rows.reduce((a, r) => a + r.orders, 0), totalCancelled = rows.reduce((a, r) => a + r.cancelled, 0);
  const avgCancelRate = totalOrders ? totalCancelled / totalOrders : 0;
  const totalPaid = rows.reduce((a, r) => a + r.paid, 0), totalRevenue = rows.reduce((a, r) => a + n(r.revenue), 0);
  const avgCheck = totalPaid ? totalRevenue / totalPaid : 0;

  // сотрудники, которые отменяли заказы, но сами заказов не принимали (например кассир или администратор)
  const known = new Set(rows.map((r) => r.id as string));
  const extra = actors.filter((a) => a.id && !known.has(a.id as string));
  const extraUsers = extra.length ? await q('select id, nombre, rol::text as rol, activo from public."Usuario" where id = any($1::text[]) and "restauranteId" = $2', [extra.map((a) => a.id), rid]) : [];
  for (const u of extraUsers) rows.push({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo, orders: 0, paid: 0, revenue: 0, cash: 0, cancelled: 0, cancelled_amount: 0, cancelled_ready: 0 });

  const list = rows.map((r) => {
    const rate = r.orders ? r.cancelled / r.orders : 0;
    const check = r.paid ? n(r.revenue) / r.paid : 0;
    const flags: string[] = [];
    if (r.orders >= 5 && r.cancelled >= 2 && rate >= Math.max(0.1, avgCancelRate * 2)) flags.push(`Много отмен: ${round2(rate * 100)}% заказов (в среднем ${round2(avgCancelRate * 100)}%)`);
    if (r.cancelled_ready >= 2) flags.push(`Отмены после «готово»: ${r.cancelled_ready}`);
    if (r.paid >= 10 && avgCheck > 0 && check < avgCheck * 0.6) flags.push(`Средний чек ниже среднего на ${Math.round((1 - check / avgCheck) * 100)}%`);
    if ((by.get(r.id) ?? 0) >= 5) flags.push(`Отменил заказов: ${by.get(r.id)}`);
    if (r.paid >= 20 && r.cash / r.paid >= 0.95 && totalPaid >= 40 && rows.some((o) => o.id !== r.id && o.paid >= 10 && o.cash / o.paid < 0.8)) flags.push('Почти все оплаты наличными');
    return { id: r.id, nombre: r.nombre, rol: r.rol, activo: r.activo, orders: r.orders, paid: r.paid, revenue: round2(n(r.revenue)), avgCheck: round2(check), cashShare: r.paid ? round2((r.cash / r.paid) * 100) : 0,
      cancelled: r.cancelled, cancelledAmount: round2(n(r.cancelled_amount)), cancelledReady: r.cancelled_ready, cancelRate: round2(rate * 100), cancelledByThem: by.get(r.id) ?? 0, flags };
  });
  res.json({ from, to, rows: list, flagged: list.filter((x) => x.flags.length).length,
    totals: { orders: totalOrders, paid: totalPaid, revenue: round2(totalRevenue), avgCheck: round2(avgCheck), cancelled: totalCancelled, cancelRate: round2(avgCancelRate * 100), cancelledAmount: round2(list.reduce((a, r) => a + r.cancelledAmount, 0)) } });
}));

router.get('/ctl/cancellations', need('ctl.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const user = typeof req.query.userId === 'string' && req.query.userId ? req.query.userId : null;
  const rows = await q(
    `select p.id, p.numero, p.tipo::text as tipo, m.numero as mesa, p."creadoEn" as created, p."actualizadoEn" as cancelled_at, p."tiempoListo" as ready_at, u.nombre as waiter, ${itemsSum} as amount,
            (select string_agg(ip.cantidad || '× ' || pr.nombre, ', ' order by pr.nombre) from public."ItemPedido" ip join public."Producto" pr on pr.id = ip."productoId" where ip."pedidoId" = p.id) as lines,
            (select a."usuarioNombre" from public."RegistroActividad" a where a.ref = p.id and a.accion = 'pedido.estado' and a.detalle = 'estado=CANCELADO' order by a."creadoEn" desc limit 1) as actor
       from public."Pedido" p left join public."Usuario" u on u.id = p."meseroId" left join public."Mesa" m on m.id = p."mesaId"
      where p."restauranteId" = $1 and p.estado = 'CANCELADO' and ${range} and ($5::text is null or p."meseroId" = $5)
      order by p."actualizadoEn" desc limit 300`, [rid, from, to, s.timezone, user]);
  res.json({ from, to, rows: rows.map((r) => ({ id: r.id, numero: r.numero, tipo: r.tipo, mesa: r.mesa, created: r.created, cancelledAt: r.cancelled_at, afterReady: !!r.ready_at,
    minutes: Math.max(0, Math.round((new Date(r.cancelled_at).getTime() - new Date(r.created).getTime()) / 60000)), waiter: r.waiter, actor: r.actor, amount: round2(n(r.amount)), lines: r.lines })) });
}));
