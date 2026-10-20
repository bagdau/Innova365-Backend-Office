import { Router } from 'express';
import Cursor from 'pg-cursor';
import { HttpError, qi, RAW_TYPES, withClient } from '../sessions';
import { ah, ident, requireWrite } from '../util';
import { buildWhere, CellValue, fq, keyWhere, tableInfo } from '../tableMeta';

export const router = Router();

const clampInt = (v: unknown, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : def;
};

/* ───────── Структура ───────── */
router.get('/tables/:schema/:name/structure', ah(async (req, res) => {
  const { schema, name } = req.params;
  const out = await withClient(req.session!, req.db, async (c) => {
    const info = await tableInfo(c, schema, name);
    const q = async (sql: string, v: unknown[] = [info.oid]) => (await c.query(sql, v)).rows;
    const indexes = await q(
      `select i.relname as name, pg_get_indexdef(x.indexrelid) as def, x.indisprimary as primary, x.indisunique as "unique",
              pg_relation_size(x.indexrelid) as size, am.amname as method,
              (select string_agg(a.attname, ', ' order by k.ord) from unnest(x.indkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = x.indrelid and a.attnum = k.attnum) as columns
         from pg_index x join pg_class i on i.oid = x.indexrelid join pg_am am on am.oid = i.relam where x.indrelid = $1 order by x.indisprimary desc, i.relname`);
    const constraints = await q(
      `select conname as name, contype::text as type, pg_get_constraintdef(oid) as def, confrelid::regclass::text as ref
         from pg_constraint where conrelid = $1 order by contype, conname`);
    const referencedBy = await q(
      `select conrelid::regclass::text as "table", conname as name, pg_get_constraintdef(oid) as def from pg_constraint where confrelid = $1 and contype = 'f' order by 1`);
    const triggers = await q(`select tgname as name, pg_get_triggerdef(oid) as def, tgenabled::text as enabled from pg_trigger where tgrelid = $1 and not tgisinternal order by tgname`);
    const stats = (await q(
      `select greatest(c.reltuples,0)::bigint as est_rows, pg_total_relation_size(c.oid) as total, pg_relation_size(c.oid) as data,
              pg_indexes_size(c.oid) as idx, coalesce(pg_total_relation_size(c.reltoastrelid), 0) as toast,
              pg_get_userbyid(c.relowner) as owner, obj_description(c.oid) as comment,
              s.n_live_tup, s.n_dead_tup, s.seq_scan, s.idx_scan, s.n_tup_ins, s.n_tup_upd, s.n_tup_del,
              s.last_vacuum, s.last_autovacuum, s.last_analyze, s.last_autoanalyze
         from pg_class c left join pg_stat_all_tables s on s.relid = c.oid where c.oid = $1`))[0];
    const viewDef = info.kind === 'v' || info.kind === 'm' ? (await q(`select pg_get_viewdef($1::oid, true) as def`))[0].def : null;
    return { ...info, indexes: indexes.map((i) => ({ ...i, size: Number(i.size) })), constraints, referencedBy, triggers, viewDef,
      stats: { ...stats, est_rows: Number(stats.est_rows), total: Number(stats.total), data: Number(stats.data), idx: Number(stats.idx), toast: Number(stats.toast) } };
  });
  res.json(out);
}));

/* ───────── Просмотр строк ───────── */
router.get('/tables/:schema/:name/rows', ah(async (req, res) => {
  const { schema, name } = req.params;
  const limit = clampInt(req.query.limit, 50, 1, 1000);
  const offset = clampInt(req.query.offset, 0, 0, 1e12);
  const out = await withClient(req.session!, req.db, async (c) => {
    const info = await tableInfo(c, schema, name);
    const w = buildWhere(info, req.query.filters, req.query.where);
    let order = '';
    if (typeof req.query.sort === 'string' && req.query.sort) {
      const col = info.columns.find((x) => x.name === req.query.sort);
      if (!col) throw new HttpError(400, `Нет колонки «${req.query.sort}»`);
      order = ` order by ${qi(col.name)} ${req.query.dir === 'desc' ? 'desc' : 'asc'} nulls last`;
    } else if (info.pk.length) order = ' order by ' + info.pk.map(qi).join(', ');
    const useCtid = !info.pk.length && ['r', 'p'].includes(info.kind);
    const sel = (useCtid ? 'ctid::text as "__ctid", ' : '') + '*';
    const started = Date.now();
    const rows = await c.query({ text: `select ${sel} from ${fq(schema, name)}${w.sql}${order} limit ${limit} offset ${offset}`, values: w.values, types: RAW_TYPES });
    let total: number; let estimated = false;
    const hasFilter = !!w.sql;
    if (!hasFilter) {
      const est = Number((await c.query(`select greatest(reltuples,0)::bigint as n from pg_class where oid = $1`, [info.oid])).rows[0].n);
      if (est > 2_000_000) { total = est; estimated = true; }
      else total = Number((await c.query(`select count(*)::bigint as n from ${fq(schema, name)}`)).rows[0].n);
    } else total = Number((await c.query({ text: `select count(*)::bigint as n from ${fq(schema, name)}${w.sql}`, values: w.values })).rows[0].n);
    return { columns: info.columns, pk: info.pk, kind: info.kind, useCtid, rows: rows.rows, total, estimated, limit, offset, ms: Date.now() - started };
  });
  res.json(out);
}));

/* ───────── Вставка / изменение / удаление ───────── */
const cellParts = (info: Awaited<ReturnType<typeof tableInfo>>, set: Record<string, CellValue>, mode: 'insert' | 'update', startIdx: number) => {
  const cols: string[] = []; const exprs: string[] = []; const values: unknown[] = [];
  for (const [k, cv] of Object.entries(set || {})) {
    const col = info.columns.find((x) => x.name === k);
    if (!col) throw new HttpError(400, `Нет колонки «${k}»`);
    let expr: string;
    if (cv?.def) expr = 'DEFAULT';
    else if (cv?.null || cv?.v === null || cv?.v === undefined) expr = 'NULL';
    else { values.push(String(cv.v)); expr = `$${startIdx + values.length - 1}`; }
    cols.push(qi(k)); exprs.push(mode === 'insert' ? expr : `${qi(k)} = ${expr}`);
  }
  return { cols, exprs, values };
};

router.post('/tables/:schema/:name/rows', ah(async (req, res) => {
  requireWrite(req);
  const { schema, name } = req.params;
  const row = await withClient(req.session!, req.db, async (c) => {
    const info = await tableInfo(c, schema, name);
    if (!['r', 'p'].includes(info.kind)) throw new HttpError(400, 'Вставка доступна только для таблиц');
    const p = cellParts(info, req.body?.values, 'insert', 1);
    const sql = p.cols.length
      ? `insert into ${fq(schema, name)} (${p.cols.join(', ')}) values (${p.exprs.join(', ')}) returning *`
      : `insert into ${fq(schema, name)} default values returning *`;
    const r = await c.query({ text: sql, values: p.values, types: RAW_TYPES });
    return { row: r.rows[0], sql };
  });
  res.status(201).json(row);
}));

router.patch('/tables/:schema/:name/rows', ah(async (req, res) => {
  requireWrite(req);
  const { schema, name } = req.params;
  const out = await withClient(req.session!, req.db, async (c) => {
    const info = await tableInfo(c, schema, name);
    if (!['r', 'p'].includes(info.kind)) throw new HttpError(400, 'Редактирование доступно только для таблиц');
    const p = cellParts(info, req.body?.set, 'update', 1);
    if (!p.exprs.length) throw new HttpError(400, 'Нечего менять');
    const k = keyWhere(info, req.body?.key || {}, p.values.length + 1);
    const sql = `update ${fq(schema, name)} set ${p.exprs.join(', ')} where ${k.sql} returning ${info.pk.length ? '*' : 'ctid::text as "__ctid", *'}`;
    await c.query('begin');
    try {
      const r = await c.query({ text: sql, values: [...p.values, ...k.values], types: RAW_TYPES });
      if (r.rowCount !== 1) throw new HttpError(409, `Изменение затронуло ${r.rowCount} строк вместо 1 — отменено`);
      await c.query('commit');
      return { row: r.rows[0], sql };
    } catch (e) { await c.query('rollback').catch(() => undefined); throw e; }
  });
  res.json(out);
}));

router.delete('/tables/:schema/:name/rows', ah(async (req, res) => {
  requireWrite(req);
  const { schema, name } = req.params;
  const keys: Record<string, unknown>[] = Array.isArray(req.body?.keys) ? req.body.keys : [];
  if (!keys.length) throw new HttpError(400, 'Не выбраны строки');
  if (keys.length > 5000) throw new HttpError(400, 'Слишком много строк за один раз');
  const out = await withClient(req.session!, req.db, async (c) => {
    const info = await tableInfo(c, schema, name);
    if (!['r', 'p'].includes(info.kind)) throw new HttpError(400, 'Удаление доступно только для таблиц');
    await c.query('begin');
    try {
      let n = 0;
      for (const key of keys) {
        const k = keyWhere(info, key, 1);
        const r = await c.query({ text: `delete from ${fq(schema, name)} where ${k.sql}`, values: k.values });
        if (r.rowCount !== 1) throw new HttpError(409, `Удаление затронуло ${r.rowCount} строк вместо 1 — отменено`);
        n += 1;
      }
      await c.query('commit');
      return { deleted: n };
    } catch (e) { await c.query('rollback').catch(() => undefined); throw e; }
  });
  res.json(out);
}));

/* ───────── Структурные операции ───────── */
const TYPE_RE = /^[A-Za-z0-9_ ,()\[\]."]{1,100}$/;
const typeOf = (v: unknown) => {
  if (typeof v !== 'string' || !TYPE_RE.test(v)) throw new HttpError(400, 'Некорректный тип данных');
  return v;
};

router.post('/tables/:schema/:name/alter', ah(async (req, res) => {
  requireWrite(req);
  const { schema, name } = req.params;
  const b = req.body || {};
  const T = fq(schema, name);
  let sql: string;
  switch (b.action) {
    case 'addColumn': {
      const col = ident(b.name, 'Имя колонки');
      sql = `alter table ${T} add column ${qi(col)} ${typeOf(b.type)}${b.notnull ? ' not null' : ''}${b.default ? ' default ' + String(b.default) : ''}`;
      break;
    }
    case 'dropColumn': sql = `alter table ${T} drop column ${qi(ident(b.name, 'Колонка'))}`; break;
    case 'renameColumn': sql = `alter table ${T} rename column ${qi(ident(b.name, 'Колонка'))} to ${qi(ident(b.to, 'Новое имя'))}`; break;
    case 'setNotNull': sql = `alter table ${T} alter column ${qi(ident(b.name, 'Колонка'))} ${b.notnull ? 'set' : 'drop'} not null`; break;
    case 'setDefault': sql = `alter table ${T} alter column ${qi(ident(b.name, 'Колонка'))} ${b.default ? 'set default ' + String(b.default) : 'drop default'}`; break;
    case 'changeType': sql = `alter table ${T} alter column ${qi(ident(b.name, 'Колонка'))} type ${typeOf(b.type)}${b.using ? ' using ' + String(b.using) : ''}`; break;
    case 'renameTable': sql = `alter table ${T} rename to ${qi(ident(b.to, 'Новое имя'))}`; break;
    case 'setComment': sql = `comment on table ${T} is ${b.comment ? "'" + String(b.comment).replace(/'/g, "''") + "'" : 'NULL'}`; break;
    case 'addIndex': {
      const cols = Array.isArray(b.columns) ? b.columns.map((x: unknown) => qi(ident(x, 'Колонка'))) : [];
      if (!cols.length) throw new HttpError(400, 'Выберите колонки индекса');
      sql = `create ${b.unique ? 'unique ' : ''}index ${qi(ident(b.name, 'Имя индекса'))} on ${T} (${cols.join(', ')})`;
      break;
    }
    case 'dropIndex': sql = `drop index ${qi(schema)}.${qi(ident(b.name, 'Индекс'))}`; break;
    case 'dropConstraint': sql = `alter table ${T} drop constraint ${qi(ident(b.name, 'Ограничение'))}`; break;
    case 'truncate': sql = `truncate table ${T}${b.restart ? ' restart identity' : ''}${b.cascade ? ' cascade' : ''}`; break;
    case 'dropTable': sql = `drop table ${T}${b.cascade ? ' cascade' : ''}`; break;
    case 'vacuum': sql = `vacuum (analyze) ${T}`; break;
    default: throw new HttpError(400, 'Неизвестная операция');
  }
  await withClient(req.session!, req.db, async (c) => {
    console.log(`[ddl] ${req.session!.user}: ${sql}`);
    await c.query(sql);
  });
  res.json({ ok: true, sql });
}));

/* ───────── Экспорт таблицы ───────── */
const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

router.get('/tables/:schema/:name/export', ah(async (req, res) => {
  const { schema, name } = req.params;
  const format = ['csv', 'json', 'sql'].includes(String(req.query.format)) ? String(req.query.format) : 'csv';
  await withClient(req.session!, req.db, async (c) => {
    const info = await tableInfo(c, schema, name);
    const w = buildWhere(info, req.query.filters, req.query.where);
    const cols = info.columns.filter((x) => !x.generated || x.generated === '');
    const names = cols.map((x) => x.name);
    // для SQL-экспорта значения сразу получаем как SQL-литералы (quote_nullable) — без потери типов
    const select = format === 'sql'
      ? cols.map((x) => `quote_nullable(${qi(x.name)}::text) as ${qi(x.name)}`).join(', ')
      : cols.map((x) => qi(x.name)).join(', ');
    const cursor = c.query(new Cursor(`select ${select} from ${fq(schema, name)}${w.sql}`, w.values as any[], { rowMode: 'array', types: RAW_TYPES as any }));
    const ext = format;
    res.setHeader('Content-Type', format === 'json' ? 'application/json; charset=utf-8' : format === 'sql' ? 'application/sql; charset=utf-8' : 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`);
    if (format === 'csv') res.write('﻿' + names.map(csvCell).join(';') + '\r\n');
    if (format === 'json') res.write('[');
    if (format === 'sql') res.write(`-- Экспорт ${schema}.${name}\n`);
    let first = true;
    for (;;) {
      const batch: unknown[][] = await new Promise((resolve, reject) => cursor.read(1000, (e: Error | undefined, rows: unknown[][]) => (e ? reject(e) : resolve(rows))));
      if (!batch.length) break;
      let chunk = '';
      for (const r of batch) {
        if (format === 'csv') chunk += r.map(csvCell).join(';') + '\r\n';
        else if (format === 'json') { const o: Record<string, unknown> = {}; names.forEach((n, i) => { o[n] = r[i]; }); chunk += (first ? '\n' : ',\n') + JSON.stringify(o); first = false; }
        else chunk += `INSERT INTO ${fq(schema, name)} (${names.map(qi).join(', ')}) VALUES (${r.join(', ')});\n`;
      }
      if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
    }
    await new Promise<void>((r) => cursor.close(() => r()));
    if (format === 'json') res.write('\n]\n');
    res.end();
  });
}));
