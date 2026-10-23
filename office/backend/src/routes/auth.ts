import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { audit, auth, authenticate, clearToken, getSettings, Me, mustSetup2fa, resetSecurityCache, setAuthCookie } from '../auth';
import { config } from '../config';
import { q, q1 } from '../db';
import { loadPerms, permsOf, ROLE_LABEL } from '../perms';
import { checkSecondFactor, createSession, getSec, logLogin, newRecoveryCodes, newSecret, otpauthUri, revokeSession, revokeUserSessions, sealSecret, secretOf, userKey, verifyTotp } from '../security';
import { ah, HttpError, parse } from '../util';

export const router = Router();

/* ───────── Вход / выход ───────── */
const tries = new Map<string, { n: number; reset: number }>();
const tooMany = (key: string) => { const t = tries.get(key); return !!t && t.reset > Date.now() && t.n >= 6; };
const fail = (key: string) => { const t = tries.get(key); tries.set(key, !t || t.reset < Date.now() ? { n: 1, reset: Date.now() + 60_000 } : { n: t.n + 1, reset: t.reset }); };
const tries2fa = new Map<string, number>();

/** Вход завершён: создаём сессию, ставим cookie, пишем в журнал. */
async function finishLogin(req: Request, res: Response, me: Me): Promise<void> {
  const sess = await createSession(req, me);
  setAuthCookie(res, me, req.secure, sess.id);
  req.me = { ...me, jti: sess.id };
  await logLogin(req, { rid: me.rid, key: userKey(me), email: me.email, ok: true, reason: 'login' });
  await audit(req, 'login', 'session');
  res.json(await meView(req.me));
}

router.post('/auth/login', ah(async (req, res) => {
  const b = parse(z.object({ email: z.string().trim().email('Введите email').max(120), password: z.string().min(1, 'Введите пароль').max(200) }), req.body);
  const ipKey = 'ip:' + req.ip, mailKey = 'em:' + b.email.toLowerCase();
  if (tooMany(ipKey) || tooMany(mailKey)) { await logLogin(req, { email: b.email, ok: false, reason: 'too_many_attempts' }); throw new HttpError(429, 'Слишком много попыток входа. Подождите минуту.'); }
  let me: Me;
  try { me = await authenticate(b.email, b.password); }
  catch (e) { fail(ipKey); fail(mailKey); await logLogin(req, { email: b.email, ok: false, reason: 'bad_credentials' }); throw e; }
  tries.delete(ipKey); tries.delete(mailKey);
  const sec = await getSec(userKey(me));
  if (sec?.totp_enabled) {
    // пароль верен, но нужен второй фактор: выдаём короткоживущий билет, а не сессию
    const ticket = jwt.sign({ purpose: '2fa', me }, config.jwtSecret, { expiresIn: '5m', jwtid: crypto.randomUUID() });
    await logLogin(req, { rid: me.rid, key: userKey(me), email: me.email, ok: true, reason: 'password_ok_2fa_pending' });
    res.json({ needs2fa: true, ticket });
    return;
  }
  await finishLogin(req, res, me);
}));

router.post('/auth/2fa', ah(async (req, res) => {
  const b = parse(z.object({ ticket: z.string().min(10), code: z.string().trim().min(6).max(20) }), req.body);
  let t: { purpose?: string; me?: Me; jti?: string };
  try { t = jwt.verify(b.ticket, config.jwtSecret) as typeof t; } catch { throw new HttpError(401, 'Время ввода кода истекло — войдите заново'); }
  if (t.purpose !== '2fa' || !t.me || !t.jti) throw new HttpError(401, 'Некорректный билет входа');
  const used = tries2fa.get(t.jti) ?? 0;
  if (used >= 5) throw new HttpError(429, 'Слишком много неверных кодов — войдите заново');
  tries2fa.set(t.jti, used + 1);
  if (!(await checkSecondFactor(userKey(t.me), b.code))) { await logLogin(req, { rid: t.me.rid, key: userKey(t.me), email: t.me.email, ok: false, reason: 'bad_2fa' }); throw new HttpError(401, 'Неверный код. Проверьте время на телефоне или используйте код восстановления.'); }
  tries2fa.delete(t.jti);
  await finishLogin(req, res, t.me);
}));

router.post('/auth/logout', ah(async (req, res) => {
  try { const tok = jwt.verify(req.cookies?.office_token ?? '', config.jwtSecret) as Me; if (tok?.jti) await revokeSession(tok.jti, 'выход'); } catch { /* уже вышел */ }
  clearToken(res);
  res.json({ ok: true });
}));

async function meView(me: Me) {
  const s = await getSettings(me.rid);
  await loadPerms(me.rid);
  const sec = await getSec(userKey(me));
  return {
    id: me.id, name: me.name, email: me.email, role: me.role, roleLabel: ROLE_LABEL[me.role], outletId: me.outletId ?? null, perms: permsOf(me), sessionId: me.jti ?? null,
    twofa: { enabled: !!sec?.totp_enabled, must: await mustSetup2fa(me) },
    settings: { currency: s.currency, company: s.company, vat: s.vat, vatEnabled: s.vatEnabled, timezone: s.timezone },
  };
}

router.use(auth);

router.get('/me', ah(async (req, res) => { res.json(await meView(req.me!)); }));

/** Смена своего пароля (для сотрудников офиса; владелец и админы меняют пароль в основной системе). Остальные сессии завершаются. */
router.put('/me/password', ah(async (req, res) => {
  const me = req.me!;
  if (me.src !== 'staff') throw new HttpError(400, 'Пароль администратора и владельца меняется в основной системе (Профиль)');
  const b = parse(z.object({ current: z.string().min(1), next: z.string().min(8, 'Пароль — минимум 8 символов').max(100) }), req.body);
  const r = await q1<{ password_hash: string }>('select password_hash from office.staff where id = $1', [me.id]);
  if (!r || !(await bcrypt.compare(b.current, r.password_hash))) throw new HttpError(400, 'Текущий пароль неверен');
  await q('update office.staff set password_hash = $2 where id = $1', [me.id, await bcrypt.hash(b.next, 10)]);
  const ended = await revokeUserSessions(userKey(me), 'смена пароля', me.jti);
  await audit(req, 'password.change', 'staff', me.id, { endedSessions: ended });
  res.json({ ok: true, endedSessions: ended });
}));

/* ───────── Двухфакторная защита ───────── */
router.get('/me/2fa', ah(async (req, res) => {
  const sec = await getSec(userKey(req.me!));
  res.json({ enabled: !!sec?.totp_enabled, recoveryLeft: sec?.totp_enabled ? sec.recovery_hashes.length : 0, must: await mustSetup2fa(req.me!) });
}));

/** Шаг 1: создаём секрет и показываем ключ (и ссылку для QR). Пока код не подтверждён, защита не включена. */
router.post('/me/2fa/setup', ah(async (req, res) => {
  const me = req.me!;
  const key = userKey(me);
  const cur = await getSec(key);
  if (cur?.totp_enabled) throw new HttpError(409, 'Двухфакторная защита уже включена');
  const secret = newSecret();
  await q(`insert into office.user_security (user_key, restaurante_id, totp_secret, totp_enabled) values ($1,$2,$3,false) on conflict (user_key) do update set totp_secret = excluded.totp_secret, totp_enabled = false, updated_at = now()`, [key, me.rid, sealSecret(secret)]);
  const s = await getSettings(me.rid);
  res.json({ secret, uri: otpauthUri(secret, me.email, s.company || 'Innova Office') });
}));

/** Шаг 2: вводим код из приложения — защита включается, выдаются коды восстановления (показываются один раз). */
router.post('/me/2fa/enable', ah(async (req, res) => {
  const me = req.me!;
  const b = parse(z.object({ code: z.string().trim().regex(/^\d{3}\s?\d{3}$/, 'Введите 6 цифр из приложения') }), req.body);
  const key = userKey(me);
  const sec = await getSec(key);
  const secret = secretOf(sec);
  if (!sec || !secret) throw new HttpError(409, 'Сначала начните настройку');
  if (sec.totp_enabled) throw new HttpError(409, 'Защита уже включена');
  const counter = verifyTotp(secret, b.code);
  if (counter === null) throw new HttpError(400, 'Неверный код. Проверьте, что время на телефоне точное, и введите актуальный код.');
  const rc = newRecoveryCodes();
  await q('update office.user_security set totp_enabled = true, last_counter = $2, recovery_hashes = $3, enabled_at = now(), updated_at = now() where user_key = $1', [key, counter, rc.hashes]);
  resetSecurityCache();
  await audit(req, '2fa.enable', 'user', me.id);
  res.json({ recoveryCodes: rc.plain });
}));

router.post('/me/2fa/disable', ah(async (req, res) => {
  const me = req.me!;
  const b = parse(z.object({ code: z.string().trim().min(6).max(20) }), req.body);
  if (!(await checkSecondFactor(userKey(me), b.code))) throw new HttpError(400, 'Неверный код');
  await q('delete from office.user_security where user_key = $1', [userKey(me)]);
  resetSecurityCache();
  await audit(req, '2fa.disable', 'user', me.id);
  res.json({ ok: true });
}));

router.post('/me/2fa/recovery', ah(async (req, res) => {
  const me = req.me!;
  const b = parse(z.object({ code: z.string().trim().min(6).max(20) }), req.body);
  if (!(await checkSecondFactor(userKey(me), b.code))) throw new HttpError(400, 'Неверный код');
  const rc = newRecoveryCodes();
  await q('update office.user_security set recovery_hashes = $2, updated_at = now() where user_key = $1', [userKey(me), rc.hashes]);
  await audit(req, '2fa.recovery', 'user', me.id);
  res.json({ recoveryCodes: rc.plain });
}));

/* ───────── Мои сессии и входы ───────── */
router.get('/me/sessions', ah(async (req, res) => {
  const rows = await q(`select id, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at from office.session where user_key = $1 and revoked_at is null and expires_at > now() order by last_seen_at desc limit 30`, [userKey(req.me!)]);
  res.json(rows.map((r) => ({ id: r.id, ip: r.ip, userAgent: r.user_agent, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === req.me!.jti })));
}));

router.delete('/me/sessions/:id', ah(async (req, res) => {
  const ok = await revokeSession(req.params.id, req.me!.name, userKey(req.me!));
  if (!ok) throw new HttpError(404, 'Сессия не найдена');
  if (req.params.id === req.me!.jti) clearToken(res);
  res.json({ ok: true });
}));

router.post('/me/sessions/revoke-others', ah(async (req, res) => {
  const n = await revokeUserSessions(userKey(req.me!), req.me!.name, req.me!.jti);
  await audit(req, 'sessions.revoke-others', 'session', null, { count: n });
  res.json({ revoked: n });
}));

router.get('/me/logins', ah(async (req, res) => {
  const rows = await q('select ok, reason, ip, user_agent, at from office.login_log where restaurante_id = $1 and (user_key = $2 or lower(email) = lower($3)) order by at desc limit 30', [req.me!.rid, userKey(req.me!), req.me!.email]);
  res.json(rows.map((r) => ({ ok: r.ok, reason: r.reason, ip: r.ip, userAgent: r.user_agent, at: r.at })));
}));
