import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { registrar } from '../audit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


function signAccess(payload: object) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

function signRefresh(payload: object) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña requeridos' });
    return;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { restaurante: true },
  });

  if (!usuario || !usuario.activo) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const valid = await bcrypt.compare(password, usuario.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

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
      restauranteId: usuario.restauranteId,
      restaurante: {
        id: usuario.restaurante.id,
        nombre: usuario.restaurante.nombre,
      },
    },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'Refresh token requerido' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as any;
    const { iat, exp, ...data } = payload;

    // Verificamos que el usuario aún exista y esté activo
    const usuario = await prisma.usuario.findUnique({
      where: { id: data.userId },
      include: { restaurante: true },
    });
    if (!usuario || !usuario.activo) {
      res.clearCookie('refreshToken');
      res.status(401).json({ error: 'Usuario inactivo' });
      return;
    }

    const accessToken  = signAccess(data);
    const newRefresh   = signRefresh(data);

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
