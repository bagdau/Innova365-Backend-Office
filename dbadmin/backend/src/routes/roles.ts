import { Router } from 'express';
import { PoolClient } from 'pg';
import { HttpError, withClient } from '../sessions';
import { ah, ident, requireWrite } from '../util';

export const router = Router();

/** Роли: атрибуты, членство, число владений. */
router.get('/roles', ah(async (req, res) => {
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select r.oid::int as oid, r.rolname as name, r.rolsuper as super, r.rolinherit as inherit, r.rolcreaterole as createrole,
            r.rolcreatedb as createdb, r.rolcanlogin as login, r.rolreplication as replication, r.rolbypassrls as bypassrls,
            r.rolconnlimit as connlimit, r.rolvaliduntil as valid_until,
            coalesce((select array_agg(g.rolname::text order by g.rolname) from pg_auth_members m join pg_roles g on g.oid = m.roleid where m.member = r.oid), '{}'::text[]) as member_of,
            (select count(*)::int from pg_stat_activity a where a.usename = r.rolname) as sessions,
            (select count(*)::int from pg_class c where c.relowner = r.oid and c.relkind in ('r','v','m','p') and c.relnamespace::regnamespace::text not in ('pg_catalog','information_schema')) as owned_tables
       from pg_roles r where r.rolname not like 'pg\\_%' order by r.rolsuper desc, r.rolname`));
  res.json(r.rows);
}));

const attrSql = async (c: PoolClient, b: Record<string, unknown>): Promise<string> => {
  const parts: string[] = [];
  const flag = (k: string, on: string, off: string) => { if (typeof b[k] === 'boolean') parts.push(b[k] ? on : off); };
  flag('super', 'SUPERUSER', 'NOSUPERUSER'); flag('createdb', 'CREATEDB', 'NOCREATEDB'); flag('createrole', 'CREATEROLE', 'NOCREATEROLE');
  flag('login', 'LOGIN', 'NOLOGIN'); flag('replication', 'REPLICATION', 'NOREPLICATION'); flag('inherit', 'INHERIT', 'NOINHERIT');
  if (b.connlimit !== undefined && b.connlimit !== null && b.connlimit !== '') {
    const n = Number(b.connlimit);
    if (!Number.isInteger(n) || n < -1) throw new HttpError(400, 'Некорректный лимит подключений');
    parts.push(`CONNECTION LIMIT ${n}`);
  }
  if (typeof b.password === 'string' && b.password) {
    const lit = (await c.query(`select quote_literal($1::text) as l`, [b.password])).rows[0].l;
    parts.push(`PASSWORD ${lit}`);
  }
  if (b.validUntil === '') parts.push(`VALID UNTIL 'infinity'`);
  else if (typeof b.validUntil === 'string') {
    const lit = (await c.query(`select quote_literal($1::text) as l`, [b.validUntil])).rows[0].l;
    parts.push(`VALID UNTIL ${lit}`);
  }
  return parts.join(' ');
};

const ident_q = async (c: PoolClient, name: string) => (await c.query(`select quote_ident($1::text) as q`, [name])).rows[0].q as string;

router.post('/roles', ah(async (req, res) => {
  requireWrite(req);
  const name = ident(req.body?.name, 'Имя роли');
  await withClient(req.session!, req.db, async (c) => {
    const attrs = await attrSql(c, req.body);
    const sql = `create role ${await ident_q(c, name)} ${attrs}`;
    console.log(`[ddl] ${req.session!.user}: create role ${name}`);
    await c.query(sql);
  });
  res.status(201).json({ ok: true });
}));

router.patch('/roles/:name', ah(async (req, res) => {
  requireWrite(req);
  const name = ident(req.params.name, 'Имя роли');
  await withClient(req.session!, req.db, async (c) => {
    const attrs = await attrSql(c, req.body);
    if (attrs) { console.log(`[ddl] ${req.session!.user}: alter role ${name}`); await c.query(`alter role ${await ident_q(c, name)} ${attrs}`); }
    if (typeof req.body?.rename === 'string' && req.body.rename && req.body.rename !== name) {
      await c.query(`alter role ${await ident_q(c, name)} rename to ${await ident_q(c, ident(req.body.rename, 'Новое имя'))}`);
    }
  });
  res.json({ ok: true });
}));

router.delete('/roles/:name', ah(async (req, res) => {
  requireWrite(req);
  const name = ident(req.params.name, 'Имя роли');
  if (name === req.session!.user) throw new HttpError(400, 'Нельзя удалить текущего пользователя');
  await withClient(req.session!, req.db, async (c) => {
    console.log(`[ddl] ${req.session!.user}: drop role ${name}`);
    await c.query(`drop role ${await ident_q(c, name)}`);
  });
  res.json({ ok: true });
}));

/** Матрица привилегий роли на таблицы и представления. */
router.get('/roles/:name/privileges', ah(async (req, res) => {
  const name = ident(req.params.name, 'Имя роли');
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select n.nspname as schema, c.relname as name, c.relkind::text as kind,
            has_table_privilege($1, c.oid, 'SELECT') as "select", has_table_privilege($1, c.oid, 'INSERT') as "insert",
            has_table_privilege($1, c.oid, 'UPDATE') as "update", has_table_privilege($1, c.oid, 'DELETE') as "delete",
            has_table_privilege($1, c.oid, 'TRUNCATE') as "truncate", has_table_privilege($1, c.oid, 'REFERENCES') as "references",
            has_table_privilege($1, c.oid, 'TRIGGER') as "trigger"
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r','v','m','p') and n.nspname not in ('pg_catalog','information_schema','pg_toast') order by 1, 2`, [name]));
  res.json(r.rows);
}));

const PRIVS = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);

router.post('/roles/:name/privileges', ah(async (req, res) => {
  requireWrite(req);
  const role = ident(req.params.name, 'Имя роли');
  const schema = ident(req.body?.schema, 'Схема'); const table = ident(req.body?.table, 'Таблица');
  const privs: string[] = (Array.isArray(req.body?.privileges) ? req.body.privileges : []).map((p: string) => String(p).toUpperCase());
  if (!privs.length || privs.some((p) => !PRIVS.has(p))) throw new HttpError(400, 'Некорректный список привилегий');
  const grant = req.body?.grant !== false;
  await withClient(req.session!, req.db, async (c) => {
    const q = async (s: string) => (await c.query(`select quote_ident($1::text) as q`, [s])).rows[0].q as string;
    const sql = `${grant ? 'grant' : 'revoke'} ${privs.join(', ')} on ${await q(schema)}.${await q(table)} ${grant ? 'to' : 'from'} ${await q(role)}`;
    console.log(`[ddl] ${req.session!.user}: ${sql}`);
    await c.query(sql);
  });
  res.json({ ok: true });
}));

/** Членство в ролях (GRANT role TO role). */
router.post('/roles/:name/membership', ah(async (req, res) => {
  requireWrite(req);
  const member = ident(req.params.name, 'Роль'); const group = ident(req.body?.group, 'Группа');
  await withClient(req.session!, req.db, async (c) => {
    const q = async (s: string) => (await c.query(`select quote_ident($1::text) as q`, [s])).rows[0].q as string;
    await c.query(`${req.body?.grant === false ? 'revoke' : 'grant'} ${await q(group)} ${req.body?.grant === false ? 'from' : 'to'} ${await q(member)}`);
  });
  res.json({ ok: true });
}));
