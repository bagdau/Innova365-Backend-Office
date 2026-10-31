import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Тех-карты: развёртка состава блюда до ингредиентов и списание/возврат со склада.
 * Расход = количество порций × брутто из тех-карты. Комбо и сеты состоят из других блюд — они раскрываются рекурсивно.
 */
type Db = Prisma.TransactionClient | typeof prisma;

export interface RecetaMap { [productoId: string]: { items: { insumoId: string | null; componenteId: string | null; cantidad: number }[] } }

/** Проценты потерь применяются последовательно; списание склада всегда берёт брутто. */
export function netAfterProcessing(gross: number, cold: number | null | undefined, hot: number | null | undefined): number {
  return Number((gross * (1 - (cold ?? 0) / 100) * (1 - (hot ?? 0) / 100)).toFixed(6));
}

export async function cargarRecetas(db: Db, restauranteId: string): Promise<RecetaMap> {
  const rows = await db.receta.findMany({ where: { restauranteId }, include: { items: true } });
  const map: RecetaMap = {};
  for (const r of rows) map[r.productoId] = { items: r.items.map((i) => ({ insumoId: i.insumoId, componenteId: i.componenteId, cantidad: Number(i.cantidad) })) };
  return map;
}

/** Ингредиенты, нужные для qty порций блюда (рекурсивно; защита от циклов и глубины). */
export function expandir(map: RecetaMap, productoId: string, qty: number, acc = new Map<string, number>(), depth = 0, path: string[] = []): Map<string, number> {
  if (depth > 5 || path.includes(productoId)) return acc;
  const r = map[productoId];
  if (!r) return acc;
  for (const it of r.items) {
    if (it.insumoId) acc.set(it.insumoId, (acc.get(it.insumoId) ?? 0) + qty * it.cantidad);
    else if (it.componenteId) expandir(map, it.componenteId, qty * it.cantidad, acc, depth + 1, [...path, productoId]);
  }
  return acc;
}

/** Находит цикл: входит ли блюдо `objetivo` в состав `desde` (прямо или через компоненты). */
export function haceCiclo(map: RecetaMap, desde: string, objetivo: string, depth = 0): boolean {
  if (desde === objetivo) return true;
  if (depth > 6) return true;
  return (map[desde]?.items ?? []).some((i) => i.componenteId && haceCiclo(map, i.componenteId, objetivo, depth + 1));
}

/**
 * Списывает со склада ингредиенты проданных позиций (внутри транзакции заказа).
 * Склад может уйти в минус: продажа не блокируется неточным остатком — минус виден в «Складе» и требует ревизии.
 */
export async function descontarItems(
  tx: Prisma.TransactionClient, restauranteId: string,
  pedido: { id: string; numero: number }, items: { id: string; productoId: string; cantidad: number }[], usuarioId?: string,
): Promise<void> {
  if (!items.length) return;
  const map = await cargarRecetas(tx, restauranteId);
  const acc = new Map<string, number>();
  const conReceta: string[] = [];
  for (const it of items) {
    if (!map[it.productoId]) continue;
    conReceta.push(it.id);
    expandir(map, it.productoId, it.cantidad, acc);
  }
  if (!acc.size) return;
  // всегда в одном порядке — исключает взаимные блокировки при параллельных заказах
  for (const [insumoId, qty] of [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const rows = await tx.$queryRaw<{ saldo: Prisma.Decimal; costo: Prisma.Decimal | null }[]>`
      UPDATE "Insumo" SET "stockActual" = "stockActual" - ${qty}::numeric, "actualizadoEn" = now()
      WHERE id = ${insumoId} AND "restauranteId" = ${restauranteId}
      RETURNING "stockActual" AS saldo, "costoUnitario" AS costo`;
    if (!rows.length) continue;
    await tx.movimientoInventario.create({
      data: { restauranteId, insumoId, tipo: 'CONSUMO', cantidad: -qty, saldo: rows[0].saldo, costoUnitario: rows[0].costo, motivo: `№${pedido.numero}`, pedidoId: pedido.id, usuarioId },
    });
  }
  if (conReceta.length) await tx.itemPedido.updateMany({ where: { id: { in: conReceta } }, data: { descontado: true } });
}

/** Возвращает на склад всё, что было списано по заказу (отмена). Считается по журналу — точно то, что реально списали. */
export async function devolverPedido(tx: Prisma.TransactionClient, restauranteId: string, pedido: { id: string; numero: number }, usuarioId?: string): Promise<void> {
  const rows = await tx.movimientoInventario.groupBy({ by: ['insumoId'], where: { pedidoId: pedido.id, tipo: { in: ['CONSUMO', 'DEVOLUCION'] } }, _sum: { cantidad: true } });
  for (const r of rows.sort((a, b) => a.insumoId.localeCompare(b.insumoId))) {
    const net = -Number(r._sum.cantidad ?? 0);              // CONSUMO отрицательный → net > 0 означает «ещё не возвращено»
    if (net <= 1e-9) continue;
    const out = await tx.$queryRaw<{ saldo: Prisma.Decimal; costo: Prisma.Decimal | null }[]>`
      UPDATE "Insumo" SET "stockActual" = "stockActual" + ${net}::numeric, "actualizadoEn" = now()
      WHERE id = ${r.insumoId} AND "restauranteId" = ${restauranteId}
      RETURNING "stockActual" AS saldo, "costoUnitario" AS costo`;
    if (!out.length) continue;
    await tx.movimientoInventario.create({
      data: { restauranteId, insumoId: r.insumoId, tipo: 'DEVOLUCION', cantidad: net, saldo: out[0].saldo, costoUnitario: out[0].costo, motivo: `№${pedido.numero}`, pedidoId: pedido.id, usuarioId },
    });
  }
  await tx.itemPedido.updateMany({ where: { pedidoId: pedido.id, descontado: true }, data: { descontado: false } });
}
