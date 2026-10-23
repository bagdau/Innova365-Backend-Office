import crypto from 'crypto';
import type { Request } from 'express';
import { config } from './config';
import { q, q1 } from './db';
import { open, seal } from './secret';

/**
 * Безопасность входа: сессии (по одной на вход, с возможностью отозвать), журнал попыток входа и одноразовые коды TOTP
 * (приложения Google Authenticator, Microsoft Authenticator, Authy и т. п.).
 */
export const userKey = (me: { src: string; id: string }) => `${me.src}:${me.id}`;
const ua = (req: Request) => String(req.get('user-agent') ?? '').slice(0, 200);

/* ───────── Сессии ───────── */
const alive = new Map<string, { ok: boolean; at: number }>();
const seen = new Map<string, number>();

export async function createSession(req: Request, me: { rid: string; src: string; id: string; name: string; role: string }): Promise<{ id: string; expires: Date }> {
  const expires = new Date(Date.now() + config.tokenHours * 3600_000);
  const r = await q1<{ id: string }>('insert into office.session (restaurante_id, user_key, user_name, role, ip, user_agent, expires_at) values ($1,$2,$3,$4,$5,$6,$7) returning id',
    [me.rid, userKey(me), me.name, me.role, req.ip ?? null, ua(req), expires]);
  alive.set(r!.id, { ok: true, at: Date.now() });
  return { id: r!.id, expires };
}

/** Сессия действует (не отозвана и не истекла). Ответ кэшируется на 15 секунд; отзыв сбрасывает кэш сразу. */
export async function sessionAlive(jti: string): Promise<boolean> {
  const c = alive.get(jti);
  if (c && Date.now() - c.at < 15_000) { touch(jti); return c.ok; }
  const r = await q1<{ revoked_at: string | null; expires_at: string }>('select revoked_at, expires_at from office.session where id = $1', [jti]);
  const ok = !!r && !r.revoked_at && new Date(r.expires_at).getTime() > Date.now();
  alive.set(jti, { ok, at: Date.now() });
  if (ok) touch(jti);
  return ok;
}
function touch(jti: string): void {
  const last = seen.get(jti) ?? 0;
  if (Date.now() - last < 60_000) return;
  seen.set(jti, Date.now());
  void q('update office.session set last_seen_at = now() where id = $1', [jti]).catch(() => undefined);
}

export async function revokeSession(id: string, by: string, restrictUserKey?: string): Promise<boolean> {
  const r = await q(`update office.session set revoked_at = now(), revoked_by = $2 where id = $1 and revoked_at is null and ($3::text is null or user_key = $3) returning id`, [id, by, restrictUserKey ?? null]);
  if (r.length) alive.set(id, { ok: false, at: Date.now() });
  return r.length > 0;
}
export async function revokeUserSessions(key: string, by: string, exceptId?: string): Promise<number> {
  const r = await q<{ id: string }>(`update office.session set revoked_at = now(), revoked_by = $2 where user_key = $1 and revoked_at is null and ($3::text is null or id <> $3) returning id`, [key, by, exceptId ?? null]);
  for (const x of r) alive.set(x.id, { ok: false, at: Date.now() });
  return r.length;
}

/* ───────── Журнал входов ───────── */
export async function logLogin(req: Request, e: { rid?: string; key?: string; email: string; ok: boolean; reason?: string }): Promise<void> {
  const rid = e.rid ?? (await q1<{ id: string }>('select id from public."Restaurante" order by "creadoEn" limit 1'))?.id;
  if (!rid) return;
  await q('insert into office.login_log (restaurante_id, user_key, email, ok, reason, ip, user_agent) values ($1,$2,$3,$4,$5,$6,$7)', [rid, e.key ?? null, e.email.slice(0, 120), e.ok, e.reason ?? null, req.ip ?? null, ua(req)]).catch(() => undefined);
}

/* ───────── TOTP (RFC 6238) ───────── */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32encode(buf: Buffer): string { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
export function b32decode(s: string): Buffer { let bits = 0, val = 0; const out: number[] = []; for (const ch of s.replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }

export const newSecret = (): string => b32encode(crypto.randomBytes(20));
export function totpAt(secret: string, counter: number): string {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
/** Совпавший счётчик (шаг 30 с, допуск ±1 шаг) или null. */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor(now / 30_000);
  for (const d of [0, -1, 1]) if (crypto.timingSafeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(c))) return step + d;
  return null;
}
export const otpauthUri = (secret: string, account: string, issuer: string) => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

export interface Sec { totp_secret: string | null; totp_enabled: boolean; last_counter: string; recovery_hashes: string[] }
export const getSec = (key: string) => q1<Sec>('select totp_secret, totp_enabled, last_counter, recovery_hashes from office.user_security where user_key = $1', [key]);
export const secretOf = (s: Sec | undefined): string | null => open(s?.totp_secret);
export const sealSecret = seal;

const rh = (code: string) => crypto.createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');
export function newRecoveryCodes(n = 8): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: n }, () => { const r = crypto.randomBytes(5).toString('hex').toUpperCase(); return `${r.slice(0, 5)}-${r.slice(5)}`; });
  return { plain, hashes: plain.map(rh) };
}
export const recoveryHash = rh;

/** Проверяет код TOTP (с защитой от повторного использования) или код восстановления. Возвращает true при успехе. */
export async function checkSecondFactor(key: string, code: string): Promise<boolean> {
  const s = await getSec(key);
  const secret = secretOf(s);
  if (!s || !s.totp_enabled || !secret) return false;
  const counter = verifyTotp(secret, code);
  if (counter !== null) {
    if (counter <= Number(s.last_counter)) return false;   // тот же код нельзя использовать дважды
    await q('update office.user_security set last_counter = $2, updated_at = now() where user_key = $1', [key, counter]);
    return true;
  }
  const h = rh(code);
  if (s.recovery_hashes.includes(h)) {
    await q('update office.user_security set recovery_hashes = array_remove(recovery_hashes, $2), updated_at = now() where user_key = $1', [key, h]);
    return true;
  }
  return false;
}

/** Раз в час убираем старые записи: истёкшие сессии, давние входы и отправки. */
export function startSecurityJanitor(): void {
  const run = () => void (async () => {
    try {
      await q(`delete from office.session where expires_at < now() - interval '30 days' or revoked_at < now() - interval '30 days'`);
      await q(`delete from office.login_log where at < now() - interval '365 days'`);
      await q(`delete from office.notify_log where at < now() - interval '180 days'`);
      await q(`delete from office.notify_sent where sent_at < now() - interval '90 days'`);
    } catch (e) { console.error('[janitor]', (e as Error).message); }
  })();
  setTimeout(run, 30_000).unref();
  setInterval(run, 3600_000).unref();
}
