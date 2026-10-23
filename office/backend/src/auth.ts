import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { q, q1 } from './db';
import { HttpError } from './util';
import { hasPerm, loadPerms, Perm, Role } from './perms';
import { getSec, sessionAlive, userKey } from './security';

export type { Role, Perm } from './perms';
export { ROLE_LABEL, hasPerm, permsOf } from './perms';

export interface Me { id: string; src: 'usuario' | 'staff'; rid: string; role: Role; name: string; email: string; outletId?: string | null; jti?: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { me?: Me } }
}

const COOKIE = 'office_token';

/* ───────── Вход ───────── */
export async function authenticate(email: string, password: string): Promise<Me> {
  const em = email.trim().toLowerCase();
  // 1) сотрудники офиса
  const st = await q1<{ id: string; restaurante_id: string; nombre: string; email: string; password_hash: string; role: Role; active: boolean; outlet_id: string | null }>(
    'select * from office.staff where lower(email) = $1', [em]);
  if (st) {
    const ok = await bcrypt.compare(password, st.password_hash);
    if (!ok || !st.active) throw new HttpError(401, 'Неверный email или пароль');
    await q('update office.staff set last_login = now() where id = $1', [st.id]);
    return { id: st.id, src: 'staff', rid: st.restaurante_id, role: st.role, name: st.nombre, email: st.email, outletId: st.outlet_id };
  }
  // 2) владелец и администраторы основной системы
  const u = await q1<{ id: string; nombre: string; email: string; passwordHash: string; rol: string; activo: boolean; restauranteId: string }>(
    `select id, nombre, email, "passwordHash", rol::text as rol, activo, "restauranteId" from public."Usuario" where lower(email) = $1`, [em]);
  if (!u || !['SUPERADMIN', 'ADMIN'].includes(u.rol)) {
    await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123'); // выравниваем время ответа
    throw new HttpError(401, 'Неверный email или пароль');
  }
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok || !u.activo) throw new HttpError(401, 'Неверный email или пароль');
  return { id: u.id, src: 'usuario', rid: u.restauranteId, role: u.rol === 'SUPERADMIN' ? 'owner' : 'admin', name: u.nombre, email: u.email };
}

/** Кладёт токен в cookie. Токен содержит идентификатор сессии (jti): отозвать сессию можно в любой момент. */
export function setAuthCookie(res: Response, me: Me, secure: boolean, jti: string): void {
  const token = jwt.sign({ ...me, jti }, config.jwtSecret, { expiresIn: `${config.tokenHours}h` });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: config.tokenHours * 3600_000, path: '/' });
}
export const clearToken = (res: Response) => { res.clearCookie(COOKIE, { path: '/' }); };

/* Проверка актуальности учётной записи не чаще раза в минуту: уволили сотрудника — доступ закрывается быстро. */
const alive = new Map<string, { ok: boolean; role?: Role; outletId?: string | null; at: number }>();
async function stillValid(me: Me): Promise<{ ok: boolean; role?: Role; outletId?: string | null }> {
  const key = `${me.src}:${me.id}`;
  const c = alive.get(key);
  if (c && Date.now() - c.at < 60_000) return c;
  let res: { ok: boolean; role?: Role; outletId?: string | null };
  if (me.src === 'staff') {
    const r = await q1<{ active: boolean; role: Role; outlet_id: string | null }>('select active, role, outlet_id from office.staff where id = $1', [me.id]);
    res = { ok: !!r?.active, role: r?.role, outletId: r?.outlet_id };
  } else {
    const r = await q1<{ activo: boolean; rol: string }>(`select activo, rol::text as rol from public."Usuario" where id = $1`, [me.id]);
    res = { ok: !!r?.activo && ['SUPERADMIN', 'ADMIN'].includes(r.rol), role: r?.rol === 'SUPERADMIN' ? 'owner' : 'admin' };
  }
  alive.set(key, { ...res, at: Date.now() });
  return res;
}
export const forgetUser = (src: string, id: string) => alive.delete(`${src}:${id}`);

/* ───────── Middleware ───────── */
export async function auth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) throw new HttpError(401, 'Требуется вход');
    let me: Me;
    try { me = jwt.verify(token, config.jwtSecret) as Me; } catch { throw new HttpError(401, 'Сессия истекла — войдите заново'); }
    if (!me.jti) throw new HttpError(401, 'Сессия устарела — войдите заново');
    if (!(await sessionAlive(me.jti))) throw new HttpError(401, 'Сессия завершена — войдите заново');
    const v = await stillValid(me);
    if (!v.ok) throw new HttpError(401, 'Учётная запись отключена');
    req.me = { ...me, role: v.role ?? me.role, outletId: v.outletId ?? me.outletId ?? null };
    await loadPerms(req.me.rid);
    if (await mustSetup2fa(req.me) && !/^\/api\/(me|auth|settings|security\/policy)(\/|\?|$)/.test(req.originalUrl)) throw new HttpError(403, 'Включите двухфакторную защиту в профиле — администратор требует её для всех', { code: '2FA_REQUIRED' });
    next();
  } catch (e) { next(e); }
}

/* ───────── Обязательная двухфакторная защита для владельца и администраторов (включается владельцем) ───────── */
const req2fa = new Map<string, { v: boolean; at: number }>();
const has2fa = new Map<string, { v: boolean; at: number }>();
export const resetSecurityCache = () => { req2fa.clear(); has2fa.clear(); };
export async function mustSetup2fa(me: Me): Promise<boolean> {
  if (me.role !== 'owner' && me.role !== 'admin') return false;
  let r = req2fa.get(me.rid);
  if (!r || Date.now() - r.at > 30_000) {
    const v = (await q1<{ value: unknown }>(`select value from office.setting where restaurante_id = $1 and key = 'security.require2fa'`, [me.rid]))?.value;
    r = { v: v === true, at: Date.now() }; req2fa.set(me.rid, r);
  }
  if (!r.v) return false;
  const k = userKey(me);
  let h = has2fa.get(k);
  if (!h || Date.now() - h.at > 30_000) { h = { v: !!(await getSec(k))?.totp_enabled, at: Date.now() }; has2fa.set(k, h); }
  return !h.v;
}

export const need = (...perms: Perm[]) => (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.me || !perms.some((p) => hasPerm(req.me!, p))) { next(new HttpError(403, 'Недостаточно прав для этого действия')); return; }
  next();
};

/* ───────── Журнал и настройки ───────── */
export async function audit(req: Request, action: string, entity?: string, entityId?: string | null, detail?: unknown): Promise<void> {
  const me = req.me!;
  await q('insert into office.audit (restaurante_id, user_id, user_name, role, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5,$6,$7,$8)',
    [me.rid, me.id, me.name, me.role, action, entity ?? null, entityId ?? null, detail === undefined ? null : JSON.stringify(detail)]).catch((e) => console.error('[audit]', e.message));
}

export interface Settings { company: string; bin: string; address: string; vat: number; vatEnabled: boolean; timezone: string; currency: string; signer: string }
const DEFAULTS: Omit<Settings, 'currency'> = { company: '', bin: '', address: '', vat: 12, vatEnabled: true, timezone: config.timezone, signer: '' };

export async function getSettings(rid: string): Promise<Settings> {
  const rows = await q<{ key: string; value: unknown }>('select key, value from office.setting where restaurante_id = $1', [rid]);
  const s: any = { ...DEFAULTS };
  for (const r of rows) s[r.key] = r.value;
  const rest = await q1<{ moneda: string; nombre: string }>('select moneda, nombre from public."Restaurante" where id = $1', [rid]);
  if (!s.company) s.company = rest?.nombre ?? '';
  return { ...s, currency: rest?.moneda ?? 'KZT' };
}
export async function setSetting(rid: string, key: string, value: unknown): Promise<void> {
  await q(`insert into office.setting (restaurante_id, key, value) values ($1,$2,$3)
           on conflict (restaurante_id, key) do update set value = excluded.value, updated_at = now()`, [rid, key, JSON.stringify(value)]);
}
