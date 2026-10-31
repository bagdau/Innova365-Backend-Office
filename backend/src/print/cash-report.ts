import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export type CashReportPeriod = 'hoy' | 'semana' | 'mes';
export interface CashReportRow { name: string; count: number; total: number }
export interface CashReportClientRow { name: string; bills: number; positions: number; total: number }
export interface CashReport {
  period: CashReportPeriod; from: string; to: string; generatedAt: string;
  created: number; paid: number; cancelled: number; open: number; positions: number; orderedPositions: number; cancelledPositions: number;
  revenue: number; cancelAmount: number; average: number;
  methods: CashReportRow[]; staff: CashReportRow[]; categories: CashReportRow[]; service: CashReportRow[];
  departments: CashReportRow[]; clients: CashReportClientRow[];
}

const amount = (value: unknown) => Number(Number(value ?? 0).toFixed(2));
const TZ = process.env.TZ || 'Asia/Almaty';
const dateLabel = (value: Date) => new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(value).replace(',', '');

export function cashReportRange(period: CashReportPeriod, now = new Date()) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === 'semana') from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  if (period === 'mes') from.setDate(1);
  const to = new Date(now);
  return { from, to };
}

/** Кассовый итог по времени оплаты, а не создания заказа. */
export async function loadCashReport(restauranteId: string, period: CashReportPeriod = 'hoy'): Promise<CashReport> {
  const now = new Date();
  const { from, to } = cashReportRange(period, now);
  // Все разделы отчёта должны видеть один и тот же снимок БД во время оплаты заказов.
  return prisma.$transaction(async (tx) => {
  const dateFilter = { gte: from, lte: to };
  const paidWhere = { restauranteId, estado: 'PAGADO' as const, actualizadoEn: dateFilter };
  const [groups, cancelled, created, open, items, orderedItems, cancelledItems] = await Promise.all([
    tx.pedido.groupBy({ by: ['metodoPago', 'meseroId', 'tipo'], where: paidWhere, _sum: { total: true }, _count: { _all: true } }),
    tx.pedido.aggregate({ where: { restauranteId, estado: 'CANCELADO', actualizadoEn: dateFilter }, _count: { _all: true }, _sum: { total: true } }),
    tx.pedido.count({ where: { restauranteId, creadoEn: dateFilter } }),
    tx.pedido.count({ where: { restauranteId, estado: { notIn: ['PAGADO', 'CANCELADO'] } } }),
    tx.itemPedido.groupBy({ by: ['productoId'], where: { pedido: paidWhere }, _sum: { cantidad: true, subtotal: true } }),
    tx.itemPedido.aggregate({ where: { pedido: { restauranteId, creadoEn: dateFilter } }, _sum: { cantidad: true } }),
    tx.itemPedido.aggregate({ where: { pedido: { restauranteId, estado: 'CANCELADO', actualizadoEn: dateFilter } }, _sum: { cantidad: true } }),
  ]);
  const ids = [...new Set(groups.map((g) => g.meseroId).filter((id): id is string => !!id))];
  const productIds = items.map((item) => item.productoId);
  const [users, products] = await Promise.all([
    ids.length ? tx.usuario.findMany({ where: { id: { in: ids }, restauranteId }, select: { id: true, nombre: true } }) : [],
    productIds.length ? tx.producto.findMany({ where: { id: { in: productIds }, restauranteId }, select: { id: true, categoria: { select: { id: true, nombre: true } } } }) : [],
  ]);
  const names = new Map(users.map((u) => [u.id, u.nombre]));
  const categoryNames = new Map(products.map((p) => [p.id, p.categoria.nombre]));
  // Подразделения — реальные точки Office, закреплённые за категориями меню.
  // Если Office ещё не развёрнут, позиции честно попадают в «Без подразделения».
  const [office] = await tx.$queryRaw<{ available: boolean }[]>(Prisma.sql`
    select (to_regclass('office.outlet_category') is not null and to_regclass('office.outlet') is not null) as available`);
  const outletRows = office?.available ? await tx.$queryRaw<{ categoria_id: string; name: string }[]>(Prisma.sql`
    select oc.categoria_id, o.name from office.outlet_category oc
      join office.outlet o on o.id = oc.outlet_id and o.restaurante_id = oc.restaurante_id
     where oc.restaurante_id = ${restauranteId}`) : [];
  const outletNames = new Map(outletRows.map((row) => [row.categoria_id, row.name]));
  const productOutlets = new Map(products.map((p) => [p.id, outletNames.get(p.categoria.id) ?? 'Без подразделения']));
  const methodMap = new Map<string, CashReportRow>();
  const staffMap = new Map<string, CashReportRow>();
  const categoryMap = new Map<string, CashReportRow>();
  const departmentMap = new Map<string, CashReportRow>();
  const serviceMap = new Map<string, CashReportRow>();
  const add = (map: Map<string, CashReportRow>, name: string, count: number, total: number) => {
    const row = map.get(name) ?? { name, count: 0, total: 0 };
    row.count += count; row.total = amount(row.total + total); map.set(name, row);
  };
  let paid = 0;
  let revenue = 0;
  for (const group of groups) {
    const count = group._count._all;
    const total = amount(group._sum.total);
    paid += count; revenue = amount(revenue + total);
    add(methodMap, group.metodoPago || 'Не указан', count, total);
    add(staffMap, group.meseroId ? names.get(group.meseroId) || 'Сотрудник удалён' : 'Не указан', count, total);
    add(serviceMap, group.tipo === 'PARA_LLEVAR' ? 'С собой' : 'Стол', count, total);
  }
  let positions = 0;
  for (const item of items) {
    const qty = item._sum.cantidad ?? 0;
    positions += qty;
    add(categoryMap, categoryNames.get(item.productoId) ?? 'Без категории', qty, amount(item._sum.subtotal));
    add(departmentMap, productOutlets.get(item.productoId) ?? 'Без подразделения', qty, amount(item._sum.subtotal));
  }
  const rows = (map: Map<string, CashReportRow>) => [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return {
    period, from: dateLabel(from), to: dateLabel(to), generatedAt: dateLabel(now),
    created, paid, cancelled: cancelled._count._all, open, positions,
    orderedPositions: orderedItems._sum.cantidad ?? 0, cancelledPositions: cancelledItems._sum.cantidad ?? 0,
    revenue, cancelAmount: amount(cancelled._sum.total), average: paid ? amount(revenue / paid) : 0,
    methods: rows(methodMap), staff: rows(staffMap), categories: rows(categoryMap),
    service: ['Стол', 'С собой'].map((name) => serviceMap.get(name) ?? { name, count: 0, total: 0 }),
    departments: rows(departmentMap),
    clients: paid ? [{ name: 'Частное лицо', bills: paid, positions, total: revenue }] : [],
  };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
