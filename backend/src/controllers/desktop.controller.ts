import { randomBytes, createHash, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../prisma';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const attempts = new Map<string, { count: number; until: number }>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z2-9]/g, '');

export function createActivationCode(): string {
  const bytes = randomBytes(12);
  const raw = [...bytes].map((byte) => alphabet[byte & 31]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export async function desktopRestaurant(req: Request): Promise<string | null | false> {
  const header = (typeof req.get === 'function' ? req.get('x-innova-device') : req.headers?.['x-innova-device']) as string | undefined;
  if (!header) return null;
  if (!/^[a-f0-9]{64}$/i.test(header)) return false;
  const device = await prisma.desktopInstallation.findUnique({ where: { tokenHash: hash(header) }, select: { restauranteId: true, revokedAt: true } });
  return device && !device.revokedAt ? device.restauranteId : false;
}

export async function activateDesktop(req: Request, res: Response): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (attempts.size > 10_000) {
    for (const [address, record] of attempts) if (record.until <= Date.now()) attempts.delete(address);
    if (attempts.size > 10_000) { res.status(429).json({ error: 'Сервис активации временно перегружен' }); return; }
  }
  const state = attempts.get(ip);
  if (state && state.until > Date.now() && state.count >= 5) {
    res.status(429).json({ error: 'Слишком много попыток. Повторите позже.' }); return;
  }
  const code = normalizeCode(String(req.body?.code ?? ''));
  const installationId = String(req.body?.installationId ?? '');
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(installationId)) {
    res.status(400).json({ error: 'Введите код в формате XXXX-XXXX-XXXX' }); return;
  }
  const restaurant = await prisma.restaurante.findUnique({ where: { activationCodeHash: hash(code) }, select: { id: true, nombre: true } });
  if (!restaurant) {
    attempts.set(ip, { count: (state && state.until > Date.now() ? state.count : 0) + 1, until: Date.now() + 15 * 60_000 });
    res.status(401).json({ error: 'Неверный код активации' }); return;
  }
  attempts.delete(ip);
  const existing = await prisma.desktopInstallation.findUnique({ where: { installationId }, select: { restauranteId: true, revokedAt: true } });
  if (existing && existing.restauranteId !== restaurant.id) {
    res.status(409).json({ error: 'Это устройство уже привязано к другому ресторану' }); return;
  }
  const token = randomBytes(32).toString('hex');
  await prisma.desktopInstallation.upsert({
    where: { installationId },
    create: { installationId, restauranteId: restaurant.id, tokenHash: hash(token) },
    update: { tokenHash: hash(token), revokedAt: null, lastSeenAt: new Date() },
  });
  res.json({ token, restaurant: { id: restaurant.id, name: restaurant.nombre } });
}

export async function verifyDesktop(req: Request, res: Response): Promise<void> {
  const id = await desktopRestaurant(req);
  if (!id) { res.status(401).json({ error: 'Активация недействительна' }); return; }
  const restaurant = await prisma.restaurante.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!restaurant) { res.status(401).json({ error: 'Активация недействительна' }); return; }
  res.json({ restaurant: { id: restaurant.id, name: restaurant.nombre } });
}

export async function activationStatus(req: Request, res: Response): Promise<void> {
  const restaurant = await prisma.restaurante.findUnique({ where: { id: req.restauranteId! }, select: { activationCodeHash: true } });
  const devices = await prisma.desktopInstallation.findMany({ where: { restauranteId: req.restauranteId! }, select: { id: true, installationId: true, createdAt: true, lastSeenAt: true, revokedAt: true }, orderBy: { createdAt: 'desc' } });
  res.json({ configured: !!restaurant?.activationCodeHash, devices });
}

export async function rotateActivationCode(req: Request, res: Response): Promise<void> {
  const code = createActivationCode();
  await prisma.restaurante.update({ where: { id: req.restauranteId! }, data: { activationCodeHash: hash(normalizeCode(code)) } });
  res.json({ code });
}

export async function revokeDesktop(req: Request, res: Response): Promise<void> {
  const result = await prisma.desktopInstallation.updateMany({ where: { id: String(req.params.id), restauranteId: req.restauranteId! }, data: { revokedAt: new Date() } });
  if (!result.count) { res.status(404).json({ error: 'Устройство не найдено' }); return; }
  res.json({ ok: true });
}
