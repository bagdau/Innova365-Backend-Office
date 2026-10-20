import { Request, Response } from 'express';
import { Prisma, EstadoCompra } from '@prisma/client';
import { prisma } from '../prisma';
import { idempotent, HttpError } from '../idem';

const num = (v: Prisma.Decimal | number | string | null | undefined) => Number(v ?? 0);

const compraInclude = {
  proveedor: { select: { id: true, nombre: true, telefono: true } },
  items: {
    orderBy: { id: 'asc' as const },
    include: { insumo: { select: { id: true, nombre: true, unidad: true } } },
  },
} satisfies Prisma.CompraInclude;

function shapeCompra(c: Prisma.CompraGetPayload<{ include: typeof compraInclude }>) {
  return {
    id: c.id,
    numero: c.numero,
    estado: c.estado,
    notas: c.notas,
    fechaEsperada: c.fechaEsperada,
    total: num(c.total),
    creadoEn: c.creadoEn,
    actualizadoEn: c.actualizadoEn,
    proveedor: c.proveedor,
    items: c.items.map((i) => ({
      id: i.id,
      insumoId: i.insumoId,
      nombre: i.insumo.nombre,
      unidad: i.insumo.unidad,
      cantidad: num(i.cantidad),
      cantidadRecibida: num(i.cantidadRecibida),
      costoUnitario: num(i.costoUnitario),
    })),
  };
}

// ───────────────────────── Listado / detalle ─────────────────────────

export async function getCompras(req: Request, res: Response): Promise<void> {
  const { estado, proveedorId, limit = '50', page = '1' } = req.query;
  const where: Prisma.CompraWhereInput = { restauranteId: req.restauranteId! };
  if (estado) where.estado = { in: String(estado).split(',') as EstadoCompra[] };
  if (proveedorId) where.proveedorId = String(proveedorId);

  const take = Math.min(parseInt(String(limit)) || 50, 200);
  const skip = (Math.max(parseInt(String(page)) || 1, 1) - 1) * take;

  const [total, rows] = await Promise.all([
    prisma.compra.count({ where }),
    prisma.compra.findMany({ where, include: compraInclude, orderBy: { creadoEn: 'desc' }, take, skip }),
  ]);
  res.json({ data: rows.map(shapeCompra), total });
}

export async function getCompra(req: Request, res: Response): Promise<void> {
  const compra = await prisma.compra.findFirst({
    where: { id: req.params.id, restauranteId: req.restauranteId! },
    include: {
      ...compraInclude,
      recepciones: {
        orderBy: { creadoEn: 'desc' },
        include: { items: true },
      },
    },
  });
  if (!compra) throw new HttpError(404, 'Registro no encontrado');
  res.json({
    ...shapeCompra(compra),
    recepciones: compra.recepciones.map((r) => ({
      id: r.id, creadoEn: r.creadoEn, notas: r.notas, cerrada: r.cerrada, usuarioId: r.usuarioId,
      items: r.items.map((it) => ({ compraItemId: it.compraItemId, insumoId: it.insumoId, cantidad: num(it.cantidad), costoUnitario: num(it.costoUnitario) })),
    })),
  });
}

// ───────────────────────── Crear compra (pedido al proveedor) ─────────────────────────

export async function createCompra(req: Request, res: Response): Promise<void> {
  const { proveedorId, items, notas, fechaEsperada, clave } = req.body as {
    proveedorId: string; items: { insumoId: string; cantidad: number; costoUnitario: number }[];
    notas?: string; fechaEsperada?: string; clave?: string;
  };
  const rid = req.restauranteId!;

  const out = await prisma.$transaction(async (tx) => {
    return idempotent(tx, clave, rid, 'compra', async () => {
      const [prov, insumos] = await Promise.all([
        tx.proveedor.findFirst({ where: { id: proveedorId, restauranteId: rid, activo: true } }),
        tx.insumo.findMany({ where: { id: { in: items.map((i) => i.insumoId) }, restauranteId: rid }, select: { id: true } }),
      ]);
      if (!prov) throw new HttpError(404, 'Proveedor no encontrado');
      if (insumos.length !== new Set(items.map((i) => i.insumoId)).size) throw new HttpError(400, 'Insumo no encontrado');

      const total = items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0);
      const compra = await tx.compra.create({
        data: {
          proveedorId, restauranteId: rid, usuarioId: req.user!.userId, notas: notas || null,
          fechaEsperada: fechaEsperada ? new Date(fechaEsperada) : null,
          total: Math.round(total * 100) / 100,
          items: { create: items.map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad, costoUnitario: i.costoUnitario })) },
        },
        include: compraInclude,
      });
      return shapeCompra(compra);
    });
  });

  res.status(out.replay ? 200 : 201).json(out.value);
}

// ───────────────────────── Recepción: qué llegó de verdad ─────────────────────────

interface RecepcionBody {
  clave?: string;
  items: { compraItemId: string; cantidad: number; costoUnitario?: number }[];
  cerrarPendientes?: boolean;
  notas?: string;
}

/**
 * Registra lo que realmente trajo el proveedor. Una sola transacción, pocas consultas SQL:
 * suma el stock atómicamente (UPDATE ... SET stock = stock + x), escribe el libro de movimientos
 * y recalcula el estado de la compra. Cantidad 0 = "no trajeron"; lo faltante queda pendiente
 * (PARCIAL) o se cierra con `cerrarPendientes`.
 */
export async function recibirCompra(req: Request, res: Response): Promise<void> {
  const { clave, items, cerrarPendientes, notas } = req.body as RecepcionBody;
  const rid = req.restauranteId!;
  const compraId = req.params.id;
  const userId = req.user!.userId;

  const out = await prisma.$transaction(async (tx) => {
    return idempotent(tx, clave, rid, `recepcion:${compraId}`, async () => {
      // Bloquea la compra: dos recepciones simultáneas se serializan
      const locked = await tx.$queryRaw<{ id: string; estado: EstadoCompra }[]>`
        SELECT id, estado FROM "Compra" WHERE id = ${compraId} AND "restauranteId" = ${rid} FOR UPDATE`;
      if (!locked.length) throw new HttpError(404, 'Registro no encontrado');
      if (locked[0].estado !== 'PEDIDA' && locked[0].estado !== 'PARCIAL') throw new HttpError(409, 'La compra ya está cerrada');

      const lineas = await tx.compraItem.findMany({ where: { compraId } });
      const porId = new Map(lineas.map((l) => [l.id, l]));

      const recibidos = new Map<string, { cantidad: number; costo: number }>();
      for (const it of items) {
        const l = porId.get(it.compraItemId);
        if (!l) throw new HttpError(400, 'Línea de compra no encontrada');
        const prev = recibidos.get(it.compraItemId);
        recibidos.set(it.compraItemId, { cantidad: (prev?.cantidad ?? 0) + it.cantidad, costo: it.costoUnitario ?? num(l.costoUnitario) });
      }

      const conStock = [...recibidos.entries()].filter(([, v]) => v.cantidad > 0);
      const hayAlgo = conStock.length > 0;
      const nuevaRecepcion = await tx.recepcion.create({
        data: {
          compraId, restauranteId: rid, usuarioId: userId, notas: notas || null, cerrada: !!cerrarPendientes,
          items: {
            create: [...recibidos.entries()].map(([compraItemId, v]) => ({
              compraItemId, insumoId: porId.get(compraItemId)!.insumoId, cantidad: v.cantidad, costoUnitario: v.costo,
            })),
          },
        },
      });

      if (hayAlgo) {
        // 1) acumulado por línea de compra (una sola sentencia)
        await tx.$executeRaw`
          UPDATE "CompraItem" ci SET "cantidadRecibida" = ci."cantidadRecibida" + v.qty
          FROM (VALUES ${Prisma.join(conStock.map(([id, v]) => Prisma.sql`(${id}::text, ${v.cantidad}::numeric)`))}) AS v(id, qty)
          WHERE ci.id = v.id`;

        // 2) stock por insumo (varias líneas del mismo insumo se suman), con costo de la última compra
        const porInsumo = new Map<string, { qty: number; costo: number }>();
        for (const [lineaId, v] of conStock) {
          const insumoId = porId.get(lineaId)!.insumoId;
          const acc = porInsumo.get(insumoId);
          porInsumo.set(insumoId, { qty: (acc?.qty ?? 0) + v.cantidad, costo: v.costo });
        }
        const filas = [...porInsumo.entries()];
        const saldos = await tx.$queryRaw<{ id: string; saldo: Prisma.Decimal }[]>`
          UPDATE "Insumo" i
          SET "stockActual" = i."stockActual" + v.qty, "costoUnitario" = v.costo, "actualizadoEn" = now()
          FROM (VALUES ${Prisma.join(filas.map(([id, v]) => Prisma.sql`(${id}::text, ${v.qty}::numeric, ${v.costo}::numeric)`))}) AS v(id, qty, costo)
          WHERE i.id = v.id AND i."restauranteId" = ${rid}
          RETURNING i.id, i."stockActual" AS saldo`;
        const saldoDe = new Map(saldos.map((s) => [s.id, s.saldo]));

        // 3) libro de movimientos
        await tx.movimientoInventario.createMany({
          data: filas.map(([insumoId, v]) => ({
            restauranteId: rid, insumoId, tipo: 'COMPRA' as const, cantidad: v.qty, saldo: saldoDe.get(insumoId) ?? 0,
            costoUnitario: v.costo, motivo: `Приёмка закупки`, compraId, recepcionId: nuevaRecepcion.id, usuarioId: userId,
          })),
        });
      }

      // 4) estado de la compra
      const total = lineas.map((l) => ({ pedido: num(l.cantidad), recibido: num(l.cantidadRecibida) + (recibidos.get(l.id)?.cantidad ?? 0) }));
      const completa = total.every((l) => l.recibido >= l.pedido);
      const algoRecibido = total.some((l) => l.recibido > 0);
      let estado: EstadoCompra;
      if (completa) estado = 'RECIBIDA';
      else if (cerrarPendientes) estado = algoRecibido ? 'RECIBIDA' : 'CANCELADA';
      else estado = algoRecibido ? 'PARCIAL' : 'PEDIDA';
      await tx.compra.update({ where: { id: compraId }, data: { estado } });

      const compra = await tx.compra.findUniqueOrThrow({ where: { id: compraId }, include: compraInclude });
      return shapeCompra(compra);
    });
  });

  res.json(out.value);
}

export async function cancelarCompra(req: Request, res: Response): Promise<void> {
  const r = await prisma.compra.updateMany({
    where: { id: req.params.id, restauranteId: req.restauranteId!, estado: 'PEDIDA' },
    data: { estado: 'CANCELADA' },
  });
  if (r.count === 0) throw new HttpError(409, 'Solo se puede cancelar una compra sin recepciones');
  const compra = await prisma.compra.findUniqueOrThrow({ where: { id: req.params.id }, include: compraInclude });
  res.json(shapeCompra(compra));
}
