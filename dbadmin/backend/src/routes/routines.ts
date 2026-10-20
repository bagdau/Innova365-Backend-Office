import { Router } from 'express';
import { HttpError, qi, RAW_TYPES, withClient } from '../sessions';
import { ah, ident, requireWrite } from '../util';

export const router = Router();

const KIND: Record<string, string> = { f: 'function', p: 'procedure' };

/** Список функций и процедур пользовательских схем. */
router.get('/routines', ah(async (req, res) => {
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select p.oid::int as oid, n.nspname as schema, p.proname as name, p.prokind::text as kind,
            pg_get_function_identity_arguments(p.oid) as args, pg_get_function_arguments(p.oid) as full_args,
            case when p.prokind = 'p' then null else pg_get_function_result(p.oid) end as returns,
            l.lanname as language, p.provolatile::text as volatility, p.prosecdef as security_definer,
            pg_get_userbyid(p.proowner) as owner, obj_description(p.oid, 'pg_proc') as comment
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
      where n.nspname not in ('pg_catalog','information_schema') and p.prokind in ('f','p')
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      order by n.nspname, p.proname, p.oid`));
  res.json(r.rows.map((x) => ({ ...x, type: KIND[x.kind] })));
}));

router.get('/routines/:oid', ah(async (req, res) => {
  const oid = Number(req.params.oid);
  if (!Number.isInteger(oid)) throw new HttpError(400, 'Некорректный oid');
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select p.oid::int as oid, n.nspname as schema, p.proname as name, p.prokind::text as kind, pg_get_functiondef(p.oid) as def,
            pg_get_function_identity_arguments(p.oid) as args, pg_get_function_arguments(p.oid) as full_args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.oid = $1 and p.prokind in ('f','p')`, [oid]));
  if (!r.rows.length) throw new HttpError(404, 'Не найдено');
  res.json({ ...r.rows[0], type: KIND[r.rows[0].kind] });
}));

/** Вызов: аргументы пишутся как SQL-выражения (1, 'abc', now()). */
router.post('/routines/:oid/run', ah(async (req, res) => {
  const oid = Number(req.params.oid);
  const args = typeof req.body?.args === 'string' ? req.body.args : '';
  if (args.includes(';')) throw new HttpError(400, 'В аргументах нельзя использовать «;»');
  const out = await withClient(req.session!, req.db, async (c) => {
    const m = await c.query(`select n.nspname as schema, p.proname as name, p.prokind::text as kind from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.oid = $1`, [oid]);
    if (!m.rows.length) throw new HttpError(404, 'Не найдено');
    const { schema, name, kind } = m.rows[0];
    const target = `${qi(schema)}.${qi(name)}(${args})`;
    const started = Date.now();
    const sql = kind === 'p' ? `call ${target}` : `select * from ${target}`;
    console.log(`[routine] ${req.session!.user}: ${sql.slice(0, 200)}`);
    const r = await c.query({ text: sql, rowMode: 'array', types: RAW_TYPES });
    return { sql, fields: (r.fields || []).map((f) => ({ name: f.name })), rows: (r.rows as unknown[][]).slice(0, 5000), rowCount: r.rowCount, ms: Date.now() - started };
  });
  res.json(out);
}));

router.delete('/routines/:oid', ah(async (req, res) => {
  requireWrite(req);
  const oid = Number(req.params.oid);
  await withClient(req.session!, req.db, async (c) => {
    const m = await c.query(`select n.nspname as schema, p.proname as name, p.prokind::text as kind, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.oid = $1`, [oid]);
    if (!m.rows.length) throw new HttpError(404, 'Не найдено');
    const x = m.rows[0];
    const sql = `drop ${KIND[x.kind]} ${qi(x.schema)}.${qi(x.name)}(${x.args})${req.query.cascade === '1' ? ' cascade' : ''}`;
    console.log(`[ddl] ${req.session!.user}: ${sql}`);
    await c.query(sql);
  });
  res.json({ ok: true });
}));

/** Сохранение определения (CREATE OR REPLACE …) — отдельная точка, чтобы требовать режим записи. */
router.post('/routines/save', ah(async (req, res) => {
  requireWrite(req);
  const def = typeof req.body?.def === 'string' ? req.body.def : '';
  if (!/^\s*create\s+(or\s+replace\s+)?(function|procedure)\s/i.test(def)) throw new HttpError(400, 'Ожидается CREATE [OR REPLACE] FUNCTION / PROCEDURE');
  await withClient(req.session!, req.db, async (c) => {
    console.log(`[ddl] ${req.session!.user}: ${def.replace(/\s+/g, ' ').slice(0, 200)}`);
    await c.query(def);
  });
  res.json({ ok: true });
}));

/** Триггеры всех таблиц. */
router.get('/triggers', ah(async (req, res) => {
  const r = await withClient(req.session!, req.db, (c) => c.query(
    `select t.oid::int as oid, t.tgname as name, c.relnamespace::regnamespace::text as schema, c.relname as "table",
            pg_get_triggerdef(t.oid) as def, t.tgenabled::text as enabled, p.proname as function
       from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
      where not t.tgisinternal and c.relnamespace::regnamespace::text not in ('pg_catalog','information_schema') order by 3, 4, 2`));
  res.json(r.rows);
}));

/** Включение/выключение триггера. */
router.post('/triggers/toggle', ah(async (req, res) => {
  requireWrite(req);
  const schema = ident(req.body?.schema, 'Схема'); const table = ident(req.body?.table, 'Таблица'); const name = ident(req.body?.name, 'Триггер');
  const sql = `alter table ${qi(schema)}.${qi(table)} ${req.body?.enable ? 'enable' : 'disable'} trigger ${qi(name)}`;
  await withClient(req.session!, req.db, (c) => c.query(sql));
  res.json({ ok: true, sql });
}));
