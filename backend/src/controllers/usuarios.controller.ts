import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { renombrarCorreos } from '../emailDomain';
import { isCurrency } from '../currency';
import bcrypt from 'bcryptjs';
import { HttpError } from '../idem';
import { isOwner, isAdminRole } from '../roles';
import { olvidarNombre } from '../audit';


export async function getUsuarios(req: Request, res: Response): Promise<void> {
  const usuarios = await prisma.usuario.findMany({
    where: { restauranteId: req.restauranteId! },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true },
    orderBy: { nombre: 'asc' },
  });
  res.json(usuarios);
}

const SELECT_USUARIO = { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true } as const;

/**
 * Иерархия: владелец (SUPERADMIN) управляет всеми; администратор — только кассирами, официантами и поварами.
 * Нельзя менять собственную роль/статус и нельзя остаться без активного владельца.
 */
async function guardUsuario(req: Request, target: { id: string; rol: string; activo: boolean } | null, next: { rol?: string; activo?: boolean }) {
  const actor = req.user!;
  const owner = isOwner(actor.rol);

  if (next.rol && isAdminRole(next.rol) && !owner) throw new HttpError(403, 'Solo el propietario puede crear o asignar administradores');

  if (target) {
    if (isAdminRole(target.rol) && !owner && target.id !== actor.userId) throw new HttpError(403, 'Solo el propietario puede cambiar cuentas de administradores y propietarios');
    if (target.id === actor.userId && ((next.rol && next.rol !== target.rol) || next.activo === false)) {
      throw new HttpError(400, 'No puedes cambiar tu propio rol ni desactivarte');
    }
    const pierdeRol = target.rol === 'SUPERADMIN' && target.activo && ((next.rol && next.rol !== 'SUPERADMIN') || next.activo === false);
    if (pierdeRol) {
      const otros = await prisma.usuario.count({ where: { restauranteId: req.restauranteId!, rol: 'SUPERADMIN', activo: true, id: { not: target.id } } });
      if (otros === 0) throw new HttpError(409, 'Debe quedar al menos un propietario activo');
    }
  }
}

export async function createUsuario(req: Request, res: Response): Promise<void> {
  const { nombre, email, password, rol } = req.body;
  await guardUsuario(req, null, { rol });
  const hash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, passwordHash: hash, rol, restauranteId: req.restauranteId! },
    select: SELECT_USUARIO,
  });
  res.status(201).json(usuario);
}

export async function updateUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nombre, email, password, rol, activo } = req.body;
  const target = await prisma.usuario.findFirst({ where: { id, restauranteId: req.restauranteId! }, select: { id: true, rol: true, activo: true } });
  if (!target) throw new HttpError(404, 'Usuario no encontrado');
  await guardUsuario(req, target, { rol, activo });

  const data: any = { nombre, email, rol, activo };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.update({ where: { id }, data, select: SELECT_USUARIO });
  olvidarNombre(id);
  res.json(usuario);
}

export async function getPerfil(req: Request, res: Response): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true,
      restaurante: { select: { nombre: true } } },
  });
  res.json(usuario);
}

export async function updatePerfil(req: Request, res: Response): Promise<void> {
  const { nombre, email } = req.body;
  const usuario = await prisma.usuario.update({
    where: { id: req.user!.userId },
    data: { nombre, email },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true },
  });
  res.json(usuario);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { passwordActual, passwordNuevo } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.userId } });
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

  const valido = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!valido) { res.status(400).json({ error: 'Contraseña actual incorrecta' }); return; }

  await prisma.usuario.update({
    where: { id: req.user!.userId },
    data: { passwordHash: await bcrypt.hash(passwordNuevo, 10) },
  });
  res.json({ ok: true });
}

export async function deleteUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const target = await prisma.usuario.findFirst({ where: { id, restauranteId: req.restauranteId! }, select: { id: true, rol: true, activo: true } });
  if (!target) throw new HttpError(404, 'Usuario no encontrado');
  await guardUsuario(req, target, { activo: false });
  await prisma.usuario.update({
    where: { id, restauranteId: req.restauranteId! },
    data: { activo: false },
  });
  res.status(204).send();
}

export async function getRestaurante(req: Request, res: Response): Promise<void> {
  const restaurante = await prisma.restaurante.findUnique({
    where: { id: req.restauranteId! },
  });
  res.json(restaurante);
}

export async function updateRestaurante(req: Request, res: Response): Promise<void> {
  const { nombre, direccion, telefono, timerMesa, pieTicket, qrTicket, moneda, qrPago } = req.body;
  if (moneda !== undefined && !isCurrency(moneda)) throw new HttpError(400, 'Moneda no admitida');
  const antes = await prisma.restaurante.findUnique({ where: { id: req.restauranteId! }, select: { nombre: true } });
  const restaurante = await prisma.restaurante.update({
    where: { id: req.restauranteId! },
    data: { nombre, direccion, telefono, timerMesa, pieTicket, qrTicket, moneda, qrPago },
  });
  // Автопереименование учётных данных: при смене названия меняем домен почт сотрудников.
  let correos: { dominio: string; cambios: number } | null = null;
  if (typeof nombre === 'string' && nombre.trim() && nombre.trim() !== antes?.nombre) {
    correos = await renombrarCorreos(req.restauranteId!, nombre).catch(() => null);
  }
  res.json({ ...restaurante, correos });
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  // Inicio del día en hora local del servidor.
  // setHours(0,0,0,0) muta el Date — usamos un new Date() fresco.
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const [ventasHoy, pedidosHoy, mesasOcupadas, totalMesas, alertas] = await Promise.all([
    prisma.pedido.aggregate({
      where: { restauranteId: req.restauranteId!, estado: { in: ['ENTREGADO', 'PAGADO'] }, creadoEn: { gte: inicio } },
      _sum: { total: true },
    }),
    prisma.pedido.count({
      where: { restauranteId: req.restauranteId!, estado: { in: ['LISTO', 'ENTREGADO', 'PAGADO'] }, creadoEn: { gte: inicio } },
    }),
    prisma.mesa.count({
      where: { restauranteId: req.restauranteId!, estado: 'OCUPADA' },
    }),
    prisma.mesa.count({ where: { restauranteId: req.restauranteId! } }),
    prisma.insumo.findMany({ where: { restauranteId: req.restauranteId! } }),
  ]);

  const alertasCount = alertas.filter((i) => {
    const stock = Number(i.stockActual);
    const min = Number(i.stockMinimo);
    return stock < min * 1.5;
  }).length;

  const pedidosRecientes = await prisma.pedido.findMany({
    where: { restauranteId: req.restauranteId! },
    orderBy: { creadoEn: 'desc' },
    take: 5,
    include: {
      mesa: { select: { numero: true } },
      items: { include: { producto: { select: { nombre: true } } } },
    },
  });

  const alertasDetalle = alertas
    .map((i) => {
      const stock = Number(i.stockActual);
      const min = Number(i.stockMinimo);
      let estado: 'CRITICO' | 'BAJO' | 'OK' = 'OK';
      if (stock < min) estado = 'CRITICO';
      else if (stock < min * 1.5) estado = 'BAJO';
      return { ...i, estado };
    })
    .filter((i) => i.estado !== 'OK');

  res.json({
    ventasHoy: Number(ventasHoy._sum.total ?? 0),
    pedidosHoy,
    mesasOcupadas,
    totalMesas,
    alertasCount,
    pedidosRecientes,
    alertasDetalle,
  });
}
