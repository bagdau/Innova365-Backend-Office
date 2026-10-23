import { Router } from 'express';
import { z } from 'zod';
import { audit, getSettings, need, setSetting } from '../auth';
import { DEFAULT_PERMS, isLocked, loadPerms, Perm, PERM_LIST, Role, ROLE_LABEL, ROLE_NOTE, ROLES, savePerms } from '../perms';
import { q } from '../db';
import { ah, HttpError, parse } from '../util';

export const router = Router();

/* ───────── Настройки ───────── */
router.get('/settings', ah(async (req, res) => { res.json(await getSettings(req.me!.rid)); }));

router.put('/settings', need('settings'), ah(async (req, res) => {
  const b = parse(z.object({
    company: z.string().trim().max(120).optional(), bin: z.string().trim().max(20).optional(), address: z.string().trim().max(200).optional(),
    signer: z.string().trim().max(120).optional(),
    vat: z.number().min(0).max(30).optional(), vatEnabled: z.boolean().optional(),
    timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Неизвестный часовой пояс').optional(),
  }), req.body);
  for (const [k, v] of Object.entries(b)) if (v !== undefined) await setSetting(req.me!.rid, k, v);
  await audit(req, 'settings.update', 'settings', null, b);
  res.json(await getSettings(req.me!.rid));
}));


/* ───────── Журнал действий ───────── */
router.get('/audit', need('audit'), ah(async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = typeof req.query.q === 'string' && req.query.q.trim() ? `%${req.query.q.trim().replace(/[\\%_]/g, '\\$&')}%` : null;
  const rows = await q(
    `select id, user_name, role, action, entity, entity_id, detail, at, count(*) over() as total from office.audit
      where restaurante_id = $1 and ($2::text is null or action ilike $2 or user_name ilike $2 or entity ilike $2)
      order by at desc limit $3 offset $4`, [req.me!.rid, search, limit, offset]);
  res.json({ total: rows[0] ? Number(rows[0].total) : 0, rows: rows.map(({ total, ...r }) => r) });
}));

/* ───────── Права доступа ролей ───────── */
router.get('/roles', need('roles'), ah(async (req, res) => {
  const m = await loadPerms(req.me!.rid);
  res.json({
    perms: PERM_LIST,
    roles: ROLES.map((r) => ({
      id: r, label: ROLE_LABEL[r], note: ROLE_NOTE[r], perms: [...(m.get(r) ?? [])],
      locked: PERM_LIST.filter((p) => isLocked(r, p.id as Perm)).map((p) => p.id), defaults: DEFAULT_PERMS[r],
    })),
  });
}));

router.put('/roles/:role', need('roles'), ah(async (req, res) => {
  const role = req.params.role as Role;
  if (!ROLES.includes(role)) throw new HttpError(404, 'Роль не найдена');
  if (role === 'owner') throw new HttpError(400, 'Права владельца не ограничиваются');
  const b = parse(z.object({ perms: z.array(z.string()).max(100) }), req.body);
  await savePerms(req.me!.rid, role, b.perms as Perm[]);
  await audit(req, 'role.perms', 'role', role, { perms: b.perms });
  const m = await loadPerms(req.me!.rid);
  res.json({ perms: [...(m.get(role) ?? [])] });
}));

router.post('/roles/:role/reset', need('roles'), ah(async (req, res) => {
  const role = req.params.role as Role;
  if (!ROLES.includes(role)) throw new HttpError(404, 'Роль не найдена');
  await q('delete from office.role_perm where restaurante_id = $1 and role = $2', [req.me!.rid, role]);
  const { resetPerms } = await import('../perms');
  resetPerms();
  await audit(req, 'role.reset', 'role', role);
  res.json({ ok: true });
}));
