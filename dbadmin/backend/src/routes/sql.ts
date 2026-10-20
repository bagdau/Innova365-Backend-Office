import { Router } from 'express';
import { PoolClient, QueryResult } from 'pg';
import { config } from '../config';
import { closeOtherPools, HttpError, RAW_TYPES, withClient } from '../sessions';
import { ah, str } from '../util';

export const router = Router();

/** Команды, меняющие данные/структуру: в режиме «Только чтение» PostgreSQL сам их отклонит, но подсказка нужна заранее. */
const typeNames = async (c: PoolClient, oids: number[]): Promise<Map<number, string>> => {
  const m = new Map<number, string>();
  if (!oids.length) return m;
  const r = await c.query(`select oid::int as oid, format_type(oid, null) as name from pg_type where oid = any($1::oid[])`, [oids]);
  for (const x of r.rows) m.set(x.oid, x.name);
  return m;
};

function shape(r: QueryResult, limit: number, names: Map<number, string>) {
  const fields = (r.fields || []).map((f) => ({ name: f.name, type: names.get(f.dataTypeID) || String(f.dataTypeID) }));
  const rows = (r.rows as unknown[][]) || [];
  return {
    command: r.command, rowCount: r.rowCount, fields,
    rows: rows.length > limit ? rows.slice(0, limit) : rows,
    truncated: rows.length > limit,
  };
}

/** Выполнить один или несколько SQL-операторов. */
router.post('/sql', ah(async (req, res) => {
  const sql = str(req.body?.sql, 'SQL', 1_000_000);
  const limit = Math.min(config.maxConsoleRows, Math.max(1, Number(req.body?.limit) || 1000));
  const timeoutMs = Math.min(10 * 60_000, Math.max(1000, Number(req.body?.timeoutMs) || config.statementTimeoutMs));
  const started = Date.now();
  console.log(`[sql] ${req.session!.user}${req.session!.readOnly ? '' : ' [WRITE]'}: ${sql.replace(/\s+/g, ' ').slice(0, 200)}`);
  if (/\bdrop\s+database\b/i.test(sql)) await closeOtherPools(req.session!, req.db || req.session!.defaultDb);
  const out = await withClient(req.session!, req.db, async (c) => {
    const raw = (await c.query({ text: sql, rowMode: 'array', types: RAW_TYPES })) as unknown as QueryResult | QueryResult[];
    const list: QueryResult[] = Array.isArray(raw) ? raw : [raw];
    const oids = [...new Set(list.flatMap((r) => (r.fields || []).map((f) => f.dataTypeID)))];
    const names = await typeNames(c, oids);
    return list.map((r) => shape(r, limit, names));
  }, { timeoutMs });
  res.json({ results: out, ms: Date.now() - started });
}));

/** EXPLAIN [ANALYZE] для запроса. ANALYZE реально выполняет запрос (в режиме чтения — только SELECT). */
router.post('/sql/explain', ah(async (req, res) => {
  const sql = str(req.body?.sql, 'SQL', 200_000).trim().replace(/;+\s*$/, '');
  if (sql.includes(';')) throw new HttpError(400, 'EXPLAIN поддерживает один оператор');
  const analyze = !!req.body?.analyze;
  const out = await withClient(req.session!, req.db, async (c) => {
    const r = await c.query({ text: `explain (${analyze ? 'analyze, buffers, ' : ''}verbose false, costs true) ${sql}`, rowMode: 'array', types: RAW_TYPES });
    return (r.rows as string[][]).map((x) => x[0]).join('\n');
  });
  res.json({ plan: out });
}));
