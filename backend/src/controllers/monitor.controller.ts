import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { listarPresencia } from '../events';

/** Кто сейчас в системе (открыт поток событий) — для администратора и владельца. */
export async function getEnLinea(req: Request, res: Response): Promise<void> {
  res.json(listarPresencia(req.restauranteId!).map((p) => ({ usuarioId: p.usuarioId, nombre: p.nombre, rol: p.rol, desde: p.desde })));
}

/** Журнал действий — только владелец. ?usuarioId=&accion=pedido&limit=100&antes=<ISO> */
export async function getAuditoria(req: Request, res: Response): Promise<void> {
  const { usuarioId, accion, antes } = req.query;
  const where: Prisma.RegistroActividadWhereInput = { restauranteId: req.restauranteId! };
  if (usuarioId) where.usuarioId = String(usuarioId);
  if (accion) where.accion = { startsWith: String(accion) };
  if (antes) where.creadoEn = { lt: new Date(String(antes)) };

  const limit = Math.min(parseInt(String(req.query.limit ?? '100')) || 100, 500);
  const [rows, usuarios] = await Promise.all([
    prisma.registroActividad.findMany({ where, orderBy: { creadoEn: 'desc' }, take: limit }),
    prisma.usuario.findMany({ where: { restauranteId: req.restauranteId! }, select: { id: true, nombre: true, rol: true }, orderBy: { nombre: 'asc' } }),
  ]);
  res.json({ registros: rows, usuarios });
}
