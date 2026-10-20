import { Router } from 'express';
import { config } from '../config';
import { destroy, getSession, login, withClient, HttpError } from '../sessions';
import { ah, auth, requireWrite, str } from '../util';

export const router = Router();

/* ───────── Вход / выход ───────── */
const attempts = new Map<string, { n: number; reset: number }>();

router.post('/auth/login', ah(async (req, res) => {
  const ip = req.ip || 'unknown';
  const a = attempts.get(ip);
  if (a && a.reset > Date.now() && a.n >= 6) throw new HttpError(429, 'Слишком много попыток входа. Подождите минуту.');
  const user = str(req.body?.user, 'Пользователь', 63);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const db = typeof req.body?.db === 'string' && req.body.db.trim() ? req.body.db.trim() : config.dbName;
  try {
    const s = await login(user, password, db, ip);
    attempts.delete(ip);
    console.log(`[login] ${user}@${db} from ${ip}`);
    res.cookie('dbs_sid', s.id, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, maxAge: 12 * 3600_000, path: '/' });
    res.json({ user: s.user, isSuper: s.isSuper, version: s.version, db: s.defaultDb, readOnly: s.readOnly });
  } catch (e: any) {
    const cur = attempts.get(ip);
    attempts.set(ip, !cur || cur.reset < Date.now() ? { n: 1, reset: Date.now() + 60_000 } : { n: cur.n + 1, reset: cur.reset });
    console.warn(`[login-fail] ${user}@${db} from ${ip}: ${e?.code || e?.message}`);
    throw e;
  }
}));

router.post('/auth/logout', ah(async (req, res) => {
  const id = req.cookies?.dbs_sid;
  if (id) await destroy(id);
  res.clearCookie('dbs_sid', { path: '/' });
  res.json({ ok: true });
}));

router.get('/auth/me', ah(async (req, res) => {
  const s = getSession(req.cookies?.dbs_sid);
  if (!s) throw new HttpError(401, 'Требуется вход');
  res.json({ user: s.user, isSuper: s.isSuper, version: s.version, db: s.defaultDb, readOnly: s.readOnly, host: `${config.dbHost}:${config.dbPort}` });
}));

/* ───────── Всё ниже — только после входа ───────── */
router.use(auth);

/** Переключатель «Только чтение / Запись». */
router.post('/auth/mode', ah(async (req, res) => {
  req.session!.readOnly = req.body?.readOnly !== false;
  console.log(`[mode] ${req.session!.user} -> ${req.session!.readOnly ? 'read-only' : 'WRITE'}`);
  res.json({ readOnly: req.session!.readOnly });
}));

router.get('/databases', ah(async (req, res) => {
  const r = await withClient(req.session!, undefined, (c) => c.query(
    `select d.datname as name, pg_get_userbyid(d.datdba) as owner, pg_encoding_to_char(d.encoding) as encoding,
            d.datcollate as collate, has_database_privilege(d.datname, 'CONNECT') as can_connect,
            case when has_database_privilege(d.datname, 'CONNECT') then pg_database_size(d.datname) end as size
       from pg_database d where not d.datistemplate order by d.datname`));
  res.json(r.rows);
}));

/** Дерево: схемы → таблицы/представления с оценкой числа строк и размером. */
router.get('/tree', ah(async (req, res) => {
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select n.nspname as schema, c.relname as name, c.relkind::text as kind,
            greatest(c.reltuples, 0)::bigint as rows, pg_total_relation_size(c.oid) as size
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r','v','m','p','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast')
        and n.nspname not like 'pg\\_temp\\_%' and n.nspname not like 'pg\\_toast\\_temp\\_%'
      order by n.nspname, c.relname`));
  res.json(r.rows.map((x) => ({ ...x, rows: Number(x.rows), size: Number(x.size) })));
}));

/** Для автодополнения в SQL-редакторе: таблица → колонки. */
router.get('/completion', ah(async (req, res) => {
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select n.nspname as schema, c.relname as table, a.attname as col
       from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
      where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','v','m','p','f')
        and n.nspname not in ('pg_catalog','information_schema','pg_toast') order by 1,2,a.attnum`));
  const out: Record<string, string[]> = {};
  for (const x of r.rows) (out[x.schema === 'public' ? x.table : `${x.schema}.${x.table}`] ||= []).push(x.col);
  res.json(out);
}));

/* ───────── Обзор сервера ───────── */
router.get('/overview', ah(async (req, res) => {
  const out = await withClient(req.session!, req.db, async (c) => {
    const one = async (sql: string) => (await c.query(sql)).rows[0];
    const info = await one(`select version() as version, current_database() as db, current_user as "user", pg_postmaster_start_time() as started,
        pg_database_size(current_database()) as size, current_setting('max_connections')::int as max_conn,
        current_setting('server_encoding') as encoding, current_setting('TimeZone') as tz, current_setting('statement_timeout') as stmt_timeout`);
    const stat = await one(`select numbackends, xact_commit, xact_rollback, blks_read, blks_hit, tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted,
        deadlocks, temp_files, temp_bytes from pg_stat_database where datname = current_database()`);
    const conns = await one(`select count(*)::int as total, count(*) filter (where state = 'active')::int as active, count(*) filter (where state = 'idle in transaction')::int as idle_tx from pg_stat_activity where datname is not null`);
    const tables = (await c.query(
      `select n.nspname as schema, c.relname as name, greatest(c.reltuples,0)::bigint as rows, pg_total_relation_size(c.oid) as total,
              pg_relation_size(c.oid) as data, pg_indexes_size(c.oid) as idx
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema','pg_toast') order by total desc limit 30`)).rows;
    const counts = await one(`select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema','pg_toast'))::int as tables,
        (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname not in ('pg_catalog','information_schema'))::int as views,
        (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema') and p.prokind in ('f','p'))::int as routines,
        (select count(*) from pg_roles where rolname not like 'pg\\_%')::int as roles,
        (select count(*) from pg_indexes where schemaname not in ('pg_catalog','information_schema'))::int as indexes`);
    const activity = (await c.query(
      `select pid, usename as "user", datname as db, application_name as app, state, wait_event_type as wait,
              extract(epoch from (now() - query_start))::float as seconds, left(query, 400) as query, client_addr::text as client
         from pg_stat_activity where pid <> pg_backend_pid() and datname is not null order by (state = 'active') desc, query_start nulls last limit 50`)).rows;
    return { info, stat, conns, tables: tables.map((t) => ({ ...t, rows: Number(t.rows), total: Number(t.total), data: Number(t.data), idx: Number(t.idx) })), counts, activity };
  });
  res.json(out);
}));

router.post('/activity/cancel', ah(async (req, res) => {
  requireWrite(req);
  const pid = Number(req.body?.pid);
  if (!Number.isInteger(pid)) throw new HttpError(400, 'Некорректный pid');
  const fn = req.body?.terminate ? 'pg_terminate_backend' : 'pg_cancel_backend';
  const r = await withClient(req.session!, req.db, (c) => c.query(`select ${fn}($1) as ok`, [pid]));
  res.json({ ok: r.rows[0].ok });
}));
