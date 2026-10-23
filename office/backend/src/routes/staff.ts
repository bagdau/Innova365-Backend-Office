import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { audit, forgetUser, need } from '../auth';
import { ROLE_LABEL, Role, STAFF_ROLES } from '../perms';
import { revokeUserSessions } from '../security';
import { q, q1 } from '../db';
import { ah, HttpError, parse } from '../util';

export const router = Router();

/** Арендатор обязан быть привязан к точке фудкорта своего ресторана; остальным роли точка не нужна. */
async function checkOutlet(rid: string, role: string, outletId: string | null | undefined): Promise<string | null> {
  if (role !== 'tenant') return null;
  if (!outletId) throw new HttpError(400, 'Для арендатора выберите точку фудкорта');
  const o = await q1('select 1 from office.outlet where id = $1 and restaurante_id = $2', [outletId, rid]);
  if (!o) throw new HttpError(400, 'Точка не найдена');
  return outletId;
}

/* ───────── Сотрудники офиса ───────── */
router.get('/staff', need('staff'), ah(async (req, res) => {
  const staff = await q('select s.id, s.nombre, s.email, s.role, s.active, s.created_at, s.last_login, s.outlet_id, o.name as outlet_name from office.staff s left join office.outlet o on o.id = s.outlet_id where s.restaurante_id = $1 order by s.created_at', [req.me!.rid]);
  const admins = await q(`select id, nombre, email, rol::text as rol, activo from public."Usuario" where "restauranteId" = $1 and rol in ('SUPERADMIN','ADMIN') order by rol, nombre`, [req.me!.rid]);
  const pos = await q(`select id, nombre, email, rol::text as rol, activo, "creadoEn" as created_at,
                              (select count(*)::int from public."Pedido" p where p."meseroId" = u.id) as orders
                         from public."Usuario" u where u."restauranteId" = $1 and u.rol::text = any($2::text[]) order by u.rol::text, lower(u.nombre)`, [req.me!.rid, Object.keys(POS_LABEL)]);
  res.json({
    pos: pos.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, roleLabel: POS_LABEL[u.rol], active: u.activo, created_at: u.created_at, orders: u.orders })),
    staff: staff.map((s) => ({ ...s, roleLabel: ROLE_LABEL[s.role as Role] })),
    admins: admins.map((a) => ({ id: a.id, nombre: a.nombre, email: a.email, role: a.rol === 'SUPERADMIN' ? 'owner' : 'admin', roleLabel: a.rol === 'SUPERADMIN' ? ROLE_LABEL.owner : ROLE_LABEL.admin, active: a.activo })),
  });
}));

const staffRole = z.enum(STAFF_ROLES);

/** Персонал кассы хранится в таблице Usuario основной системы — оттуда он входит в кассу innova365.kz. */
const POS_LABEL: Record<string, string> = { MESERO: 'Официант', CAJERO: 'Кассир', COCINERO: 'Повар', REPARTIDOR: 'Доставщик' };
const posRole = z.enum(['MESERO', 'CAJERO', 'COCINERO', 'REPARTIDOR']);

/** Роль «Доставщик» появляется в БД с обновлением кассы (миграция основной системы). */
async function checkRol(rol: string): Promise<void> {
  const r = await q1(`select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'Rol' and e.enumlabel = $1`, [rol]);
  if (!r) throw new HttpError(409, 'Эта роль ещё не доступна в базе: обновите кассовую систему (backend) до последней версии');
}
const emailTaken = async (email: string, exceptUsuario?: string) =>
  !!(await q1(`select 1 from office.staff where lower(email) = lower($1) union all select 1 from public."Usuario" where lower(email) = lower($1) and ($2::text is null or id <> $2)`, [email, exceptUsuario ?? null]));

router.post('/staff', need('staff'), ah(async (req, res) => {
  const b = parse(z.object({ nombre: z.string().trim().min(2, 'Укажите имя').max(80), email: z.string().trim().email('Некорректный email').max(120), password: z.string().min(8, 'Пароль — минимум 8 символов').max(100), role: staffRole, outletId: z.string().nullish() }), req.body);
  const outletId = await checkOutlet(req.me!.rid, b.role, b.outletId);
  const dup = await q1(`select 1 from office.staff where lower(email) = lower($1) union all select 1 from public."Usuario" where lower(email) = lower($1)`, [b.email]);
  if (dup) throw new HttpError(409, 'Пользователь с таким email уже существует');
  const r = await q1('insert into office.staff (restaurante_id, nombre, email, password_hash, role, outlet_id) values ($1,$2,$3,$4,$5,$6) returning id, nombre, email, role, active, created_at, outlet_id',
    [req.me!.rid, b.nombre, b.email.toLowerCase(), await bcrypt.hash(b.password, 10), b.role, outletId]);
  await audit(req, 'staff.create', 'staff', r!.id, { email: b.email, role: b.role, outletId });
  res.status(201).json(r);
}));

router.patch('/staff/:id', need('staff'), ah(async (req, res) => {
  const b = parse(z.object({ nombre: z.string().trim().min(2).max(80).optional(), role: staffRole.optional(), active: z.boolean().optional(), password: z.string().min(8, 'Пароль — минимум 8 символов').max(100).optional(), outletId: z.string().nullish() }), req.body);
  const cur = await q1<{ role: string; outlet_id: string | null }>('select role, outlet_id from office.staff where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!cur) throw new HttpError(404, 'Сотрудник не найден');
  const role = b.role ?? cur.role;
  const outletId = await checkOutlet(req.me!.rid, role, b.outletId === undefined ? cur.outlet_id : b.outletId);
  await q(`update office.staff set nombre = coalesce($2, nombre), role = $3, active = coalesce($4, active), password_hash = coalesce($5, password_hash), outlet_id = $6 where id = $1`,
    [req.params.id, b.nombre ?? null, role, b.active ?? null, b.password ? await bcrypt.hash(b.password, 10) : null, outletId]);
  forgetUser('staff', req.params.id);
  if (b.active === false || b.password || (b.role && b.role !== cur.role)) await revokeUserSessions('staff:' + req.params.id, req.me!.name);
  await audit(req, 'staff.update', 'staff', req.params.id, { ...b, password: b.password ? '***' : undefined });
  res.json({ ok: true });
}));

router.delete('/staff/:id', need('staff'), ah(async (req, res) => {
  const r = await q('delete from office.staff where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Сотрудник не найден');
  forgetUser('staff', req.params.id);
  await revokeUserSessions('staff:' + req.params.id, req.me!.name);
  await audit(req, 'staff.delete', 'staff', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Персонал кассы: официанты, кассиры, повара, доставщики ───────── */
router.post('/staff/pos', need('staff'), ah(async (req, res) => {
  const b = parse(z.object({ nombre: z.string().trim().min(2, 'Укажите имя').max(80), email: z.string().trim().email('Некорректный email').max(120), password: z.string().min(8, 'Пароль — минимум 8 символов').max(100), rol: posRole }), req.body);
  await checkRol(b.rol);
  if (await emailTaken(b.email)) throw new HttpError(409, 'Пользователь с таким email уже существует');
  const r = await q1(`insert into public."Usuario" (id, nombre, email, "passwordHash", rol, activo, "restauranteId") values ('usr-' || gen_random_uuid()::text, $1, $2, $3, $4::"Rol", true, $5) returning id`,
    [b.nombre, b.email.toLowerCase(), await bcrypt.hash(b.password, 10), b.rol, req.me!.rid]);
  await audit(req, 'pos-staff.create', 'usuario', r!.id, { email: b.email, rol: b.rol });
  res.status(201).json({ id: r!.id });
}));

router.patch('/staff/pos/:id', need('staff'), ah(async (req, res) => {
  const b = parse(z.object({ nombre: z.string().trim().min(2).max(80).optional(), rol: posRole.optional(), active: z.boolean().optional(), password: z.string().min(8, 'Пароль — минимум 8 символов').max(100).optional() }), req.body);
  const cur = await q1(`select rol::text as rol from public."Usuario" where id = $1 and "restauranteId" = $2`, [req.params.id, req.me!.rid]);
  if (!cur || !POS_LABEL[cur.rol]) throw new HttpError(404, 'Сотрудник не найден (администраторов и владельца меняют в кассе)');
  if (b.rol) await checkRol(b.rol);
  await q(`update public."Usuario" set nombre = coalesce($2, nombre), rol = coalesce($3::"Rol", rol), activo = coalesce($4, activo), "passwordHash" = coalesce($5, "passwordHash") where id = $1`,
    [req.params.id, b.nombre ?? null, b.rol ?? null, b.active ?? null, b.password ? await bcrypt.hash(b.password, 10) : null]);
  await audit(req, 'pos-staff.update', 'usuario', req.params.id, { ...b, password: b.password ? '***' : undefined });
  res.json({ ok: true });
}));

router.delete('/staff/pos/:id', need('staff'), ah(async (req, res) => {
  const cur = await q1(`select rol::text as rol, (select count(*)::int from public."Pedido" p where p."meseroId" = u.id) as orders from public."Usuario" u where u.id = $1 and u."restauranteId" = $2`, [req.params.id, req.me!.rid]);
  if (!cur || !POS_LABEL[cur.rol]) throw new HttpError(404, 'Сотрудник не найден');
  if (cur.orders > 0) throw new HttpError(409, `У сотрудника есть заказы (${cur.orders}) — удалить нельзя. Отключите доступ переключателем: история заказов сохранится.`);
  await q('delete from public."Usuario" where id = $1', [req.params.id]);
  await audit(req, 'pos-staff.delete', 'usuario', req.params.id);
  res.json({ ok: true });
}));
