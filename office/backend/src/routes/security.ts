import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, need, resetSecurityCache } from '../auth';
import { q } from '../db';
import { hasPerm, ROLE_LABEL, Role } from '../perms';
import { revokeSession, revokeUserSessions } from '../security';
import { ah, HttpError, parse } from '../util';

/** Администрирование безопасности: политика 2FA, пользователи, активные сессии, журнал входов. */
export const router = Router();
router.use('/security', auth);

router.get('/security/policy', need('staff', 'roles'), ah(async (req, res) => {
  const v = (await q<{ value: unknown }>(`select value from office.setting where restaurante_id = $1 and key = 'security.require2fa'`, [req.me!.rid]))[0]?.value;
  res.json({ require2fa: v === true, canChange: hasPerm(req.me!, 'roles') });
}));

/** Обязательная двухфакторная защита для владельца и администраторов. Меняет только тот, у кого есть право «Права доступа» (по умолчанию — владелец). */
router.put('/security/policy', need('roles'), ah(async (req, res) => {
  const b = parse(z.object({ require2fa: z.boolean() }), req.body);
  await q(`insert into office.setting (restaurante_id, key, value) values ($1,'security.require2fa',$2) on conflict (restaurante_id, key) do update set value = excluded.value, updated_at = now()`, [req.me!.rid, JSON.stringify(b.require2fa)]);
  resetSecurityCache();
  await audit(req, 'security.policy', 'security', null, b);
  res.json(b);
}));

/** Все, кто может войти в Office, с состоянием защиты. */
router.get('/security/users', need('staff'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const rows = await q(
    `select 'usuario:' || u.id as key, u.nombre as name, u.email, case when u.rol::text = 'SUPERADMIN' then 'owner' else 'admin' end as role, u.activo as active, null::timestamptz as last_login
       from public."Usuario" u where u."restauranteId" = $1 and u.rol::text in ('SUPERADMIN', 'ADMIN')
     union all
     select 'staff:' || s.id, s.nombre, s.email, s.role, s.active, s.last_login from office.staff s where s.restaurante_id = $1
     order by 4, 2`, [rid]);
  const [sec, ses, last] = await Promise.all([
    q('select user_key, totp_enabled from office.user_security where restaurante_id = $1', [rid]),
    q(`select user_key, count(*)::int as c from office.session where restaurante_id = $1 and revoked_at is null and expires_at > now() group by 1`, [rid]),
    q(`select user_key, max(at) as at from office.login_log where restaurante_id = $1 and ok and reason = 'login' group by 1`, [rid]),
  ]);
  res.json(rows.map((r) => ({
    key: r.key, name: r.name, email: r.email, role: r.role, roleLabel: ROLE_LABEL[r.role as Role], active: r.active,
    twofa: !!sec.find((s) => s.user_key === r.key)?.totp_enabled, sessions: ses.find((s) => s.user_key === r.key)?.c ?? 0, lastLogin: last.find((l) => l.user_key === r.key)?.at ?? r.last_login,
  })));
}));

/** Сбросить двухфакторную защиту пользователя (потерял телефон). Все его сессии завершаются. Владельца может сбросить только владелец. */
router.post('/security/users/:key/reset-2fa', need('staff'), ah(async (req, res) => {
  const key = req.params.key;
  const target = await q(`select role from (select 'usuario:' || u.id as k, case when u.rol::text = 'SUPERADMIN' then 'owner' else 'admin' end as role from public."Usuario" u where u."restauranteId" = $1
                                            union all select 'staff:' || s.id, s.role from office.staff s where s.restaurante_id = $1) x where k = $2`, [req.me!.rid, key]);
  if (!target.length) throw new HttpError(404, 'Пользователь не найден');
  if (target[0].role === 'owner' && req.me!.role !== 'owner') throw new HttpError(403, 'Защиту владельца может сбросить только владелец');
  await q('delete from office.user_security where user_key = $1 and restaurante_id = $2', [key, req.me!.rid]);
  const ended = await revokeUserSessions(key, req.me!.name);
  resetSecurityCache();
  await audit(req, '2fa.reset', 'user', key, { endedSessions: ended });
  res.json({ ok: true, endedSessions: ended });
}));

router.get('/security/sessions', need('staff', 'audit'), ah(async (req, res) => {
  const rows = await q(`select id, user_key, user_name, role, ip, user_agent, created_at, last_seen_at, expires_at from office.session where restaurante_id = $1 and revoked_at is null and expires_at > now() order by last_seen_at desc limit 200`, [req.me!.rid]);
  res.json(rows.map((r) => ({ id: r.id, userKey: r.user_key, userName: r.user_name, role: r.role, roleLabel: ROLE_LABEL[r.role as Role] ?? r.role, ip: r.ip, userAgent: r.user_agent, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === req.me!.jti })));
}));

router.delete('/security/sessions/:id', need('staff'), ah(async (req, res) => {
  const s = (await q<{ role: string; user_name: string }>('select role, user_name from office.session where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]))[0];
  if (!s) throw new HttpError(404, 'Сессия не найдена');
  if (s.role === 'owner' && req.me!.role !== 'owner') throw new HttpError(403, 'Сессию владельца может завершить только владелец');
  await revokeSession(req.params.id, req.me!.name);
  await audit(req, 'session.revoke', 'session', req.params.id, { user: s.user_name });
  res.json({ ok: true });
}));

router.get('/security/logins', need('audit'), ah(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const onlyFail = req.query.ok === '0';
  const search = typeof req.query.q === 'string' && req.query.q.trim() ? `%${req.query.q.trim().replace(/[\\%_]/g, '\\$&')}%` : null;
  const rows = await q(`select ok, reason, email, ip, user_agent, at, count(*) over() as total from office.login_log where restaurante_id = $1 and (not $2::boolean or not ok) and ($3::text is null or email ilike $3 or ip ilike $3)
                         order by at desc limit $4 offset $5`, [req.me!.rid, onlyFail, search, limit, offset]);
  res.json({ total: rows[0] ? Number(rows[0].total) : 0, rows: rows.map(({ total, ...r }) => ({ ok: r.ok, reason: r.reason, email: r.email, ip: r.ip, userAgent: r.user_agent, at: r.at })) });
}));
