import { Request, Response } from 'express';
import { Prisma, TipoMovimiento } from '@prisma/client';
import { prisma } from '../prisma';
import { idempotent, HttpError } from '../idem';

const num = (v: Prisma.Decimal | number | string | null | undefined) => Number(v ?? 0);

// ───────────────────────── Proveedores ─────────────────────────

export async function getProveedores(req: Request, res: Response): Promise<void> {
  const all = req.query.todos === '1';
  const rows = await prisma.proveedor.findMany({
    where: { restauranteId: req.restauranteId!, ...(all ? {} : { activo: true }) },
    orderBy: { nombre: 'asc' },
  });
  res.json(rows);
}

export async function createProveedor(req: Request, res: Response): Promise<void> {
  const { nombre, contacto, telefono, email, notas } = req.body;
  const p = await prisma.proveedor.create({ data: { nombre, contacto, telefono, email, notas, restauranteId: req.restauranteId! } });
  res.status(201).json(p);
}

export async function updateProveedor(req: Request, res: Response): Promise<void> {
  const { nombre, contacto, telefono, email, notas, activo } = req.body;
  const p = await prisma.proveedor.update({
    where: { id: req.params.id, restauranteId: req.restauranteId! },
    data: { nombre, contacto, telefono, email, notas, activo },
  });
  res.json(p);
}

// ───────────────────────── Libro de movimientos ─────────────────────────

export async function getMovimientos(req: Request, res: Response): Promise<void> {
  const { insumoId, tipo, limit = '100', antes } = req.query;
  const where: Prisma.MovimientoInventarioWhereInput = { restauranteId: req.restauranteId! };
  if (insumoId) where.insumoId = String(insumoId);
  if (tipo) where.tipo = { in: String(tipo).split(',') as TipoMovimiento[] };
  if (antes) where.creadoEn = { lt: new Date(String(antes)) };

  const rows = await prisma.movimientoInventario.findMany({
    where, orderBy: { creadoEn: 'desc' }, take: Math.min(parseInt(String(limit)) || 100, 500),
    include: { insumo: { select: { nombre: true, unidad: true } } },
  });
  const userIds = [...new Set(rows.map((r) => r.usuarioId).filter(Boolean))] as string[];
  const users = userIds.length ? await prisma.usuario.findMany({ where: { id: { in: userIds } }, select: { id: true, nombre: true } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, u.nombre]));

  res.json(rows.map((r) => ({
    id: r.id, tipo: r.tipo, cantidad: num(r.cantidad), saldo: num(r.saldo), costoUnitario: r.costoUnitario === null ? null : num(r.costoUnitario),
    motivo: r.motivo, compraId: r.compraId, creadoEn: r.creadoEn,
    insumoId: r.insumoId, insumo: r.insumo.nombre, unidad: r.insumo.unidad,
    usuario: r.usuarioId ? nameOf.get(r.usuarioId) ?? null : null,
  })));
}

// ───────────────────────── Ajuste / merma ─────────────────────────

/**
 * Cambia el stock de un insumo de forma atómica y deja el movimiento en el libro.
 * La condición `stock + delta >= 0` impide dejar el stock en negativo incluso con peticiones simultáneas.
 */
export async function ajustarInsumo(req: Request, res: Response): Promise<void> {
  const { clave, tipo, cantidad, motivo } = req.body as { clave?: string; tipo: 'AJUSTE' | 'MERMA'; cantidad: number; motivo?: string };
  const rid = req.restauranteId!;
  const id = req.params.id;
  const delta = tipo === 'MERMA' ? -Math.abs(cantidad) : cantidad;

  const out = await prisma.$transaction(async (tx) => {
    return idempotent(tx, clave, rid, `ajuste:${id}`, async () => {
      const rows = await tx.$queryRaw<{ saldo: Prisma.Decimal }[]>`
        UPDATE "Insumo" SET "stockActual" = "stockActual" + ${delta}::numeric, "actualizadoEn" = now()
        WHERE id = ${id} AND "restauranteId" = ${rid} AND "stockActual" + ${delta}::numeric >= 0
        RETURNING "stockActual" AS saldo`;
      if (!rows.length) {
        const exists = await tx.insumo.findFirst({ where: { id, restauranteId: rid }, select: { id: true } });
        throw new HttpError(exists ? 409 : 404, exists ? 'Stock insuficiente para la operación' : 'Registro no encontrado');
      }
      const mov = await tx.movimientoInventario.create({
        data: { restauranteId: rid, insumoId: id, tipo, cantidad: delta, saldo: rows[0].saldo, motivo: motivo || null, usuarioId: req.user!.userId },
      });
      return { insumoId: id, saldo: num(rows[0].saldo), movimientoId: mov.id };
    });
  });
  res.json(out.value);
}

// ───────────────────────── Revisión (conteo físico) ─────────────────────────

/**
 * Fija el stock al conteo real. Para cada insumo con diferencia crea un movimiento REVISION
 * (cantidad = contado − anterior). Todo en una transacción y dos sentencias SQL.
 */
export async function aplicarRevision(req: Request, res: Response): Promise<void> {
  const { clave, conteos, notas } = req.body as { clave?: string; conteos: { insumoId: string; contado: number }[]; notas?: string };
  const rid = req.restauranteId!;

  const out = await prisma.$transaction(async (tx) => {
    return idempotent(tx, clave, rid, 'revision', async () => {
      const rows = await tx.$queryRaw<{ id: string; antes: Prisma.Decimal; despues: Prisma.Decimal; costo: Prisma.Decimal | null }[]>`
        WITH v(id, contado) AS (VALUES ${Prisma.join(conteos.map((c) => Prisma.sql`(${c.insumoId}::text, ${c.contado}::numeric)`))}),
        old AS (
          SELECT i.id, i."stockActual" AS antes FROM "Insumo" i JOIN v ON v.id = i.id
          WHERE i."restauranteId" = ${rid} FOR UPDATE OF i
        )
        UPDATE "Insumo" i SET "stockActual" = v.contado, "actualizadoEn" = now()
        FROM v JOIN old ON old.id = v.id
        WHERE i.id = v.id
        RETURNING i.id, old.antes, i."stockActual" AS despues, i."costoUnitario" AS costo`;

      const cambios = rows.filter((r) => !r.antes.equals(r.despues));
      if (cambios.length) {
        await tx.movimientoInventario.createMany({
          data: cambios.map((r) => ({
            restauranteId: rid, insumoId: r.id, tipo: 'REVISION' as const,
            cantidad: r.despues.minus(r.antes), saldo: r.despues, costoUnitario: r.costo,
            motivo: notas ? `Ревизия: ${notas}` : 'Ревизия', usuarioId: req.user!.userId,
          })),
        });
      }
      return {
        revisados: rows.length,
        conDiferencia: cambios.length,
        detalle: rows.map((r) => ({ insumoId: r.id, antes: num(r.antes), contado: num(r.despues), diferencia: num(r.despues) - num(r.antes), costo: r.costo === null ? null : num(r.costo) })),
      };
    });
  });
  res.json(out.value);
}
