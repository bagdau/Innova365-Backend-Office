import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { registrar } from '../audit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pinKey } from '../pin';
import { desktopRestaurant } from './desktop.controller';

const pinAttemptsByIp = new Map<string, { count: number; until: number }>();
const PIN_WINDOW_MS = 15 * 60_000;
const PIN_LIMIT = 5;

function pinClientIp(req: Request): string {
  // Nginx передаёт адрес клиента. Прямые подключения к backend не доверяют заголовку.
  const peer = req.socket?.remoteAddress ?? req.ip ?? 'unknown';
  const dockerPeer = /^(?:::ffff:)?172\.(1[6-9]|2\d|3[01])\./.test(peer);
  return dockerPeer && req.headers?.['x-real-ip'] && typeof req.headers['x-real-ip'] === 'string'
    ? req.headers['x-real-ip'] : peer;
}

function pinRateState(ip: string) {
  const state = pinAttemptsByIp.get(ip);
  if (state && state.until > Date.now()) return state;
  pinAttemptsByIp.delete(ip);
  return null;
}


function signAccess(payload: object) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

function signRefresh(payload: object) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const desktopId = await desktopRestaurant(req);
  if (desktopId === false) { res.status(401).json({ error: 'Активация приложения недействительна' }); return; }
  const { email, password, pin } = req.body;
  if ((!password && !pin) || (password && !email)) {
    res.status(400).json({ error: 'Укажите пароль с email или PIN' });
    return;
  }

  const pinLogin = typeof pin === 'string';
  const clientIp = pinLogin ? pinClientIp(req) : '';
  if (pinLogin && (pinRateState(clientIp)?.count ?? 0) >= PIN_LIMIT) {
    res.status(429).json({ error: 'Слишком много попыток входа по PIN. Повторите через 15 минут.' });
    return;
  }

  // У локальной копии БД свой JWT_SECRET; старые pinKey из серверного дампа
  // не подходят. Проверяем хеши активных сотрудников этого устройства.
  const usuario = pinLogin && !email && process.env.INNOVA_LOCAL_MODE === '1'
    ? (await (async () => {
        const candidates = await prisma.usuario.findMany({ where: { activo: true, pinHash: { not: null } }, include: { restaurante: true } });
        const matches = [];
        for (const candidate of candidates) if (candidate.pinHash && await bcrypt.compare(pin, candidate.pinHash)) matches.push(candidate);
        return matches.length === 1 ? matches[0] : null;
      })())
    : await prisma.usuario.findUnique({
        where: pinLogin && !email ? { pinKey: pinKey(pin) } : { email },
        include: { restaurante: true },
      });

  if (!usuario || !usuario.activo || (desktopId && usuario.restauranteId !== desktopId)) {
    if (pinLogin) {
      const state = pinRateState(clientIp);
      pinAttemptsByIp.set(clientIp, { count: (state?.count ?? 0) + 1, until: state?.until ?? Date.now() + PIN_WINDOW_MS });
    }
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  if (pinLogin && usuario.pinLockedUntil && usuario.pinLockedUntil > new Date()) {
    res.status(429).json({ error: 'Вход по PIN временно заблокирован. Попробуйте через 15 минут или войдите по паролю.' });
    return;
  }
  const valid = pinLogin
    ? !!usuario.pinHash && await bcrypt.compare(pin, usuario.pinHash)
    : await bcrypt.compare(password, usuario.passwordHash);
  if (!valid) {
    if (pinLogin) {
      const state = pinRateState(clientIp);
      pinAttemptsByIp.set(clientIp, { count: (state?.count ?? 0) + 1, until: state?.until ?? Date.now() + PIN_WINDOW_MS });
    }
    if (pinLogin && usuario.pinHash) {
      const failed = await prisma.usuario.update({ where: { id: usuario.id }, data: { pinAttempts: { increment: 1 } }, select: { pinAttempts: true } });
      if (failed.pinAttempts >= 5) {
        await prisma.usuario.update({ where: { id: usuario.id }, data: { pinAttempts: 0, pinLockedUntil: new Date(Date.now() + 15 * 60_000) } });
      }
    }
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }
  if (pinLogin && (usuario.pinAttempts || usuario.pinLockedUntil)) {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { pinAttempts: 0, pinLockedUntil: null } });
  }
  if (pinLogin) pinAttemptsByIp.delete(clientIp);

  const payload = {
    userId: usuario.id,
    restauranteId: usuario.restauranteId,
    rol: usuario.rol,
    email: usuario.email,
  };

  void registrar({ restauranteId: usuario.restauranteId, usuarioId: usuario.id, usuarioNombre: usuario.nombre, rol: usuario.rol, accion: 'sesion.entrada', metodo: 'POST', ruta: '/api/auth/login', estado: 200 });

  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      waiterPercent: Number(usuario.waiterPercent),
      restauranteId: usuario.restauranteId,
      restaurante: {
        id: usuario.restaurante.id,
        nombre: usuario.restaurante.nombre,
      },
    },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const desktopId = await desktopRestaurant(req);
  if (desktopId === false) { res.clearCookie('refreshToken'); res.status(401).json({ error: 'Активация приложения недействительна' }); return; }
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'Refresh token requerido' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as any;
    // Verificamos que el usuario aún exista y esté activo
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.userId },
      include: { restaurante: true },
    });
    if (!usuario || !usuario.activo || (desktopId && usuario.restauranteId !== desktopId)) {
      res.clearCookie('refreshToken');
      res.status(401).json({ error: 'Usuario inactivo' });
      return;
    }

    // Роль и ресторан могли измениться после выдачи cookie: берём актуальные права из БД.
    const freshPayload = {
      userId: usuario.id,
      restauranteId: usuario.restauranteId,
      rol: usuario.rol,
      email: usuario.email,
    };
    const accessToken  = signAccess(freshPayload);
    const newRefresh   = signRefresh(freshPayload);

    // Sliding session: reissue refresh cookie en cada refresh
    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Devolvemos también user para que el frontend hidrate sin tener que hacer otro fetch
    res.json({
      accessToken,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        waiterPercent: Number(usuario.waiterPercent),
        restauranteId: usuario.restauranteId,
        restaurante: { id: usuario.restaurante.id, nombre: usuario.restaurante.nombre },
      },
    });
  } catch {
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'Refresh token inválido' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('refreshToken');
  res.json({ message: 'Sesión cerrada' });
}
