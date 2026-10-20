import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../idem';


function calcularEstado(stockActual: number, stockMinimo: number): 'OK' | 'BAJO' | 'CRITICO' {
  if (stockActual < stockMinimo) return 'CRITICO';
  if (stockActual < stockMinimo * 1.5) return 'BAJO';
  return 'OK';
}

export async function getInventario(req: Request, res: Response): Promise<void> {
  const insumos = await prisma.insumo.findMany({
    where: { restauranteId: req.restauranteId! },
    orderBy: { nombre: 'asc' },
  });
  const result = insumos.map((i) => ({
    ...i,
    estado: calcularEstado(Number(i.stockActual), Number(i.stockMinimo)),
  }));
  res.json(result);
}

export async function getAlertas(req: Request, res: Response): Promise<void> {
  const insumos = await prisma.insumo.findMany({
    where: { restauranteId: req.restauranteId! },
  });
  const alertas = insumos
    .map((i) => ({ ...i, estado: calcularEstado(Number(i.stockActual), Number(i.stockMinimo)) }))
    .filter((i) => i.estado !== 'OK');
  res.json(alertas);
}

export async function createInsumo(req: Request, res: Response): Promise<void> {
  const { nombre, categoria, unidad, stockActual = 0, stockMinimo = 0, proveedor } = req.body;
  const dup = await prisma.insumo.findFirst({ where: { restauranteId: req.restauranteId!, nombre: { equals: nombre, mode: 'insensitive' } }, select: { id: true } });
  if (dup) throw new HttpError(409, 'Ингредиент с таким названием уже есть');
  const insumo = await prisma.$transaction(async (tx) => {
    const created = await tx.insumo.create({
      data: { nombre, categoria, unidad, stockActual, stockMinimo, proveedor, restauranteId: req.restauranteId! },
    });
    if (Number(stockActual) > 0) {
      await tx.movimientoInventario.create({
        data: { restauranteId: req.restauranteId!, insumoId: created.id, tipo: 'INICIAL', cantidad: stockActual, saldo: stockActual, motivo: 'Начальный остаток', usuarioId: req.user!.userId },
      });
    }
    return created;
  });
  res.status(201).json({ ...insumo, estado: calcularEstado(Number(insumo.stockActual), Number(insumo.stockMinimo)) });
}

export async function updateInsumo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nombre, categoria, unidad, stockActual, stockMinimo, proveedor } = req.body;
  // El stock no se edita "a mano": un cambio queda registrado como AJUSTE en el libro de movimientos
  const insumo = await prisma.$transaction(async (tx) => {
    const antes = await tx.insumo.findFirst({ where: { id, restauranteId: req.restauranteId! } });
    if (!antes) throw new HttpError(404, 'Registro no encontrado');
    if (nombre && nombre.toLowerCase() !== antes.nombre.toLowerCase()) {
      const dup = await tx.insumo.findFirst({ where: { restauranteId: req.restauranteId!, nombre: { equals: nombre, mode: 'insensitive' }, NOT: { id } }, select: { id: true } });
      if (dup) throw new HttpError(409, 'Ингредиент с таким названием уже есть');
    }
    const updated = await tx.insumo.update({ where: { id }, data: { nombre, categoria, unidad, stockActual, stockMinimo, proveedor } });
    if (stockActual !== undefined && !updated.stockActual.equals(antes.stockActual)) {
      await tx.movimientoInventario.create({
        data: { restauranteId: req.restauranteId!, insumoId: id, tipo: 'AJUSTE', cantidad: updated.stockActual.minus(antes.stockActual), saldo: updated.stockActual, motivo: 'Ручная правка', usuarioId: req.user!.userId },
      });
    }
    return updated;
  });
  res.json({ ...insumo, estado: calcularEstado(Number(insumo.stockActual), Number(insumo.stockMinimo)) });
}

export async function deleteInsumo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.insumo.delete({ where: { id, restauranteId: req.restauranteId! } });
  res.status(204).send();
}
