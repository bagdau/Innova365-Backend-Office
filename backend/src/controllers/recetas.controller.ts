import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../idem';
import { cargarRecetas, expandir, haceCiclo, netAfterProcessing, RecetaMap } from '../recetas';

const num = (v: Prisma.Decimal | number | string | null | undefined) => Number(v ?? 0);

interface InsumoLite { id: string; nombre: string; unidad: string; stock: number; minimo: number; costo: number | null }

async function insumosMap(rid: string): Promise<Map<string, InsumoLite>> {
  const rows = await prisma.insumo.findMany({ where: { restauranteId: rid }, select: { id: true, nombre: true, unidad: true, stockActual: true, stockMinimo: true, costoUnitario: true } });
  return new Map(rows.map((i) => [i.id, { id: i.id, nombre: i.nombre, unidad: i.unidad, stock: num(i.stockActual), minimo: num(i.stockMinimo), costo: i.costoUnitario === null ? null : num(i.costoUnitario) }]));
}

/** Брутто на порцию — склад списывает именно его; нетто и тепловые потери на остаток не влияют. */
function availability(map: RecetaMap, ins: Map<string, InsumoLite>, productoId: string) {
  const need = map[productoId] ? expandir(map, productoId, 1) : new Map<string, number>();
  const ingredients = [...need].filter(([, qty]) => qty > 0).map(([id, qty]) => {
    const item = ins.get(id);
    const stock = item?.stock ?? 0;
    const minimo = item?.minimo ?? 0;
    const lowAt = Math.max(minimo, qty * 3);
    const highAt = Math.max(minimo * 2, qty * 20);
    const status = !item || stock <= lowAt ? 'low' : stock >= highAt ? 'surplus' : 'normal';
    return { insumoId: id, nombre: item?.nombre ?? 'Ингредиент не найден', unidad: item?.unidad ?? '', porcion: qty, stock, minimo, porciones: Math.floor(Math.max(0, stock) / qty), status };
  });
  const status = !ingredients.length ? 'none' : ingredients.some((i) => i.status === 'low') ? 'low' : ingredients.every((i) => i.status === 'surplus') ? 'surplus' : 'normal';
  const porciones = ingredients.length ? Math.min(...ingredients.map((i) => i.porciones)) : null;
  return { status, porciones, ingredients };
}

/** Себестоимость 1 порции и «на сколько порций хватит остатков». */
function calcular(map: RecetaMap, ins: Map<string, InsumoLite>, productoId: string) {
  const need = expandir(map, productoId, 1);
  let costo = 0; let incompleto = false; let porciones: number | null = null;
  for (const [id, q] of need) {
    const i = ins.get(id); if (!i || q <= 0) continue;
    if (i.costo === null) incompleto = true; else costo += q * i.costo;
    const p = Math.floor(Math.max(0, i.stock) / q);
    porciones = porciones === null ? p : Math.min(porciones, p);
  }
  return { costo, incompleto, porciones };
}

/** Сводка по всем блюдам: есть ли тех-карта, себестоимость, остаток порций (для меню). */
export async function getRecetas(req: Request, res: Response): Promise<void> {
  const rid = req.restauranteId!;
  const [map, ins, prods] = await Promise.all([cargarRecetas(prisma, rid), insumosMap(rid), prisma.producto.findMany({ where: { restauranteId: rid }, select: { id: true, precio: true } })]);
  res.json(prods.map((p) => {
    const r = map[p.id];
    if (!r) return { productoId: p.id, tieneReceta: false, items: 0, costo: 0, incompleto: false, porciones: null, stockStatus: 'none', margen: null };
    const c = calcular(map, ins, p.id);
    const stock = availability(map, ins, p.id);
    const precio = num(p.precio);
    return { productoId: p.id, tieneReceta: true, items: r.items.length,
      ...(req.user!.rol === 'CAJERO' ? {} : { costo: Math.round(c.costo * 100) / 100, incompleto: c.incompleto, margen: precio > 0 ? Math.round((1 - c.costo / precio) * 1000) / 10 : null }),
      porciones: stock.porciones, stockStatus: stock.status };
  }));
}

async function tarjeta(rid: string, productoId: string) {
  const producto = await prisma.producto.findFirst({ where: { id: productoId, restauranteId: rid }, select: { id: true, nombre: true, precio: true, descripcion: true } });
  if (!producto) throw new HttpError(404, 'Producto no encontrado');
  const [receta, map, ins, prods] = await Promise.all([
    prisma.receta.findUnique({ where: { productoId }, include: { items: { orderBy: { id: 'asc' } } } }),
    cargarRecetas(prisma, rid), insumosMap(rid),
    prisma.producto.findMany({ where: { restauranteId: rid }, select: { id: true, nombre: true } }),
  ]);
  const names = new Map(prods.map((p) => [p.id, p.nombre]));
  const items = (receta?.items ?? []).map((i) => {
    if (i.insumoId) {
      const x = ins.get(i.insumoId);
      const cant = num(i.cantidad);
      return { id: i.id, tipo: 'insumo' as const, insumoId: i.insumoId, componenteId: null, nombre: x?.nombre ?? '—', unidad: x?.unidad ?? '', cantidad: cant, neto: i.neto === null ? null : num(i.neto), coldLossPct: i.coldLossPct === null ? null : num(i.coldLossPct), hotLossPct: i.hotLossPct === null ? null : num(i.hotLossPct), costo: x?.costo === null || !x ? null : cant * x.costo, stock: x?.stock ?? 0 };
    }
    const cant = num(i.cantidad);
    const c = calcular(map, ins, i.componenteId!);
    return { id: i.id, tipo: 'plato' as const, insumoId: null, componenteId: i.componenteId, nombre: names.get(i.componenteId!) ?? '—', unidad: 'порц.', cantidad: cant, neto: null, coldLossPct: null, hotLossPct: null, costo: c.costo * cant, stock: c.porciones ?? 0 };
  });
  const c = receta ? calcular(map, ins, productoId) : { costo: 0, incompleto: false, porciones: null };
  const stock = availability(map, ins, productoId);
  const precio = num(producto.precio);
  return {
    productoId, nombre: producto.nombre, precio, tieneReceta: !!receta,
    rendimiento: receta?.rendimiento === null || !receta ? null : num(receta.rendimiento), tecnologia: receta?.tecnologia ?? '',
    items, costo: Math.round(c.costo * 100) / 100, incompleto: c.incompleto, porciones: stock.porciones, stockStatus: stock.status,
    margen: precio > 0 && receta ? Math.round((1 - c.costo / precio) * 1000) / 10 : null,
    actualizadoEn: receta?.actualizadoEn ?? null,
  };
}

export async function getReceta(req: Request, res: Response): Promise<void> {
  res.json(await tarjeta(req.restauranteId!, req.params.productoId));
}

export async function getRecetaStock(req: Request, res: Response): Promise<void> {
  const rid = req.restauranteId!;
  const productoId = req.params.productoId;
  const producto = await prisma.producto.findFirst({ where: { id: productoId, restauranteId: rid }, select: { id: true, nombre: true } });
  if (!producto) throw new HttpError(404, 'Producto no encontrado');
  const [map, ins] = await Promise.all([cargarRecetas(prisma, rid), insumosMap(rid)]);
  const stock = availability(map, ins, productoId);
  const movements = stock.ingredients.length ? await prisma.movimientoInventario.findMany({
    where: { restauranteId: rid, insumoId: { in: stock.ingredients.map((i) => i.insumoId) } },
    orderBy: { creadoEn: 'desc' }, take: 50,
    select: { id: true, insumoId: true, tipo: true, cantidad: true, saldo: true, motivo: true, creadoEn: true },
  }) : [];
  res.json({ productoId, nombre: producto.nombre, ...stock, movements: movements.map((m) => ({ ...m, cantidad: num(m.cantidad), saldo: num(m.saldo) })) });
}

/** Сохраняет тех-карту целиком (состав заменяется). Пустой состав — тех-карта удаляется. */
export async function putReceta(req: Request, res: Response): Promise<void> {
  const rid = req.restauranteId!;
  const productoId = req.params.productoId;
  const { rendimiento, tecnologia, items } = req.body as { rendimiento?: number | null; tecnologia?: string | null; items: { insumoId?: string | null; componenteId?: string | null; cantidad: number; neto?: number | null; coldLossPct?: number | null; hotLossPct?: number | null }[] };

  const prod = await prisma.producto.findFirst({ where: { id: productoId, restauranteId: rid }, select: { id: true } });
  if (!prod) throw new HttpError(404, 'Producto no encontrado');

  const insIds = items.map((i) => i.insumoId).filter(Boolean) as string[];
  const compIds = items.map((i) => i.componenteId).filter(Boolean) as string[];
  const [okIns, okComp] = await Promise.all([
    prisma.insumo.count({ where: { id: { in: insIds }, restauranteId: rid } }),
    prisma.producto.count({ where: { id: { in: compIds }, restauranteId: rid } }),
  ]);
  if (okIns !== new Set(insIds).size || okComp !== new Set(compIds).size) throw new HttpError(404, 'Registro no encontrado');
  if (items.some((i) => !!i.insumoId === !!i.componenteId)) throw new HttpError(400, 'Datos inválidos');
  if (new Set(insIds).size !== insIds.length || new Set(compIds).size !== compIds.length) throw new HttpError(400, 'Ingrediente repetido en la receta');

  // цикл: блюдо не может входить в собственный состав (в том числе через другие комбо)
  const map = await cargarRecetas(prisma, rid);
  map[productoId] = { items: items.map((i) => ({ insumoId: i.insumoId ?? null, componenteId: i.componenteId ?? null, cantidad: i.cantidad })) };
  if (compIds.some((c) => haceCiclo(map, c, productoId))) throw new HttpError(400, 'Ciclo en la receta');

  await prisma.$transaction(async (tx) => {
    if (items.length === 0) { await tx.receta.deleteMany({ where: { productoId } }); return; }
    const r = await tx.receta.upsert({
      where: { productoId },
      create: { productoId, restauranteId: rid, rendimiento: rendimiento ?? null, tecnologia: tecnologia?.trim() || null },
      update: { rendimiento: rendimiento ?? null, tecnologia: tecnologia?.trim() || null },
    });
    await tx.recetaItem.deleteMany({ where: { recetaId: r.id } });
    await tx.recetaItem.createMany({ data: items.map((i) => ({
      recetaId: r.id, insumoId: i.insumoId ?? null, componenteId: i.componenteId ?? null, cantidad: i.cantidad,
      neto: i.insumoId && (i.coldLossPct != null || i.hotLossPct != null)
        ? netAfterProcessing(i.cantidad, i.coldLossPct, i.hotLossPct) : i.neto ?? null,
      coldLossPct: i.insumoId ? i.coldLossPct ?? null : null, hotLossPct: i.insumoId ? i.hotLossPct ?? null : null,
    })) });
  });
  res.json(await tarjeta(rid, productoId));
}

/** Расход ингредиентов за период (по журналу склада) и продажи блюд: куда уходят продукты. */
export async function getConsumo(req: Request, res: Response): Promise<void> {
  const rid = req.restauranteId!;
  const periodo = String(req.query.periodo ?? 'semana');
  const dias = periodo === 'hoy' ? 1 : periodo === 'mes' ? 30 : 7;
  const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - (dias - 1));

  const [movs, ins, items] = await Promise.all([
    prisma.movimientoInventario.groupBy({ by: ['insumoId'], where: { restauranteId: rid, tipo: { in: ['CONSUMO', 'DEVOLUCION'] }, creadoEn: { gte: desde } }, _sum: { cantidad: true } }),
    insumosMap(rid),
    prisma.itemPedido.groupBy({ by: ['productoId'], where: { pedido: { restauranteId: rid, creadoEn: { gte: desde }, estado: { not: 'CANCELADO' } } }, _sum: { cantidad: true } }),
  ]);
  const ingredientes = movs.map((m) => {
    const i = ins.get(m.insumoId); const usado = -num(m._sum.cantidad);
    if (!i) return null;
    const diario = usado / dias;
    return { insumoId: i.id, nombre: i.nombre, unidad: i.unidad, consumo: usado, costo: i.costo === null ? null : usado * i.costo, stock: i.stock, diasRestantes: diario > 0 ? Math.floor(Math.max(0, i.stock) / diario) : null };
  }).filter((x): x is NonNullable<typeof x> => !!x && x.consumo > 0).sort((a, b) => (b.costo ?? 0) - (a.costo ?? 0));

  const [map, prods] = await Promise.all([cargarRecetas(prisma, rid), prisma.producto.findMany({ where: { restauranteId: rid }, select: { id: true, nombre: true, precio: true } })]);
  const info = new Map(prods.map((p) => [p.id, p]));
  const platos = items.map((it) => {
    const p = info.get(it.productoId); if (!p) return null;
    const vendidos = num(it._sum.cantidad);
    const c = map[p.id] ? calcular(map, ins, p.id) : null;
    return { productoId: p.id, nombre: p.nombre, vendidos, ingresos: vendidos * num(p.precio), costo: c ? c.costo * vendidos : null, sinReceta: !c };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.vendidos - a.vendidos);

  res.json({ periodo, desde, ingredientes, platos });
}
