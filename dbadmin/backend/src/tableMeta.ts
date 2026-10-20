import { PoolClient } from 'pg';
import { HttpError, qi } from './sessions';

export interface ColumnInfo {
  name: string; type: string; typeName: string; notnull: boolean; default: string | null;
  identity: string; generated: string; isPk: boolean; num: number; comment: string | null;
}
export interface TableInfo {
  oid: number; schema: string; name: string; kind: string; columns: ColumnInfo[]; pk: string[];
}

export const fq = (schema: string, name: string) => `${qi(schema)}.${qi(name)}`;

/** Структура таблицы по каталогу; бросает 404, если такой таблицы нет. */
export async function tableInfo(c: PoolClient, schema: string, name: string): Promise<TableInfo> {
  const reg = await c.query(
    `select c.oid::int as oid, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = $2 and c.relkind in ('r','v','m','p','f')`, [schema, name]);
  if (!reg.rows.length) throw new HttpError(404, `Таблица ${schema}.${name} не найдена`);
  const { oid, relkind } = reg.rows[0];
  const cols = await c.query(
    `select a.attnum::int as num, a.attname as name, format_type(a.atttypid, a.atttypmod) as type, t.typname as "typeName",
            a.attnotnull as notnull, pg_get_expr(d.adbin, d.adrelid) as "default", a.attidentity::text as identity,
            a.attgenerated::text as generated, col_description(a.attrelid, a.attnum) as comment
       from pg_attribute a join pg_type t on t.oid = a.atttypid
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = $1 and a.attnum > 0 and not a.attisdropped order by a.attnum`, [oid]);
  const pkq = await c.query(
    `select a.attname as name from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = $1 and i.indisprimary order by array_position(i.indkey::int2[], a.attnum)`, [oid]);
  const pk = pkq.rows.map((r) => r.name as string);
  return {
    oid, schema, name, kind: relkind,
    columns: cols.rows.map((r) => ({ ...r, isPk: pk.includes(r.name) })),
    pk,
  };
}

export interface Filter { col: string; op: string; value?: string }
const OPS = new Set(['contains', 'eq', 'ne', 'starts', 'ends', 'gt', 'gte', 'lt', 'lte', 'isnull', 'notnull']);

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => '\\' + m);

/** Собирает WHERE по фильтрам из интерфейса. Имена колонок проверяются по каталогу, значения идут параметрами. */
export function buildWhere(info: TableInfo, filtersJson: unknown, rawWhere: unknown, startIdx = 1): { sql: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  let filters: Filter[] = [];
  if (typeof filtersJson === 'string' && filtersJson) {
    try { filters = JSON.parse(filtersJson); } catch { throw new HttpError(400, 'Некорректные фильтры'); }
  } else if (Array.isArray(filtersJson)) filters = filtersJson as Filter[];
  for (const f of filters) {
    const col = info.columns.find((c) => c.name === f.col);
    if (!col) throw new HttpError(400, `Нет колонки «${f.col}»`);
    if (!OPS.has(f.op)) throw new HttpError(400, `Неизвестный оператор «${f.op}»`);
    const id = qi(col.name);
    if (f.op === 'isnull') { parts.push(`${id} is null`); continue; }
    if (f.op === 'notnull') { parts.push(`${id} is not null`); continue; }
    const v = String(f.value ?? '');
    const p = () => { values.push(v); return `$${startIdx + values.length - 1}`; };
    switch (f.op) {
      case 'contains': values.push('%' + likeEscape(v) + '%'); parts.push(`${id}::text ilike $${startIdx + values.length - 1}`); break;
      case 'starts': values.push(likeEscape(v) + '%'); parts.push(`${id}::text ilike $${startIdx + values.length - 1}`); break;
      case 'ends': values.push('%' + likeEscape(v)); parts.push(`${id}::text ilike $${startIdx + values.length - 1}`); break;
      case 'eq': parts.push(`${id}::text = ${p()}`); break;
      case 'ne': parts.push(`${id}::text is distinct from ${p()}`); break;
      case 'gt': parts.push(`${id} > ${p()}`); break;
      case 'gte': parts.push(`${id} >= ${p()}`); break;
      case 'lt': parts.push(`${id} < ${p()}`); break;
      case 'lte': parts.push(`${id} <= ${p()}`); break;
    }
  }
  if (typeof rawWhere === 'string' && rawWhere.trim()) {
    // выражение администратора; скобки не дают «вылезти» за пределы условия, ; запрещена
    if (rawWhere.includes(';')) throw new HttpError(400, 'В условии WHERE нельзя использовать «;»');
    parts.push(`(${rawWhere})`);
  }
  return { sql: parts.length ? ' where ' + parts.join(' and ') : '', values };
}

/** Условие по ключу строки: первичный ключ или ctid, если ключа нет. */
export function keyWhere(info: TableInfo, key: Record<string, unknown>, startIdx: number): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const parts: string[] = [];
  if (info.pk.length) {
    for (const k of info.pk) {
      if (!(k in key)) throw new HttpError(400, `Не передан ключ «${k}»`);
      values.push(key[k]); parts.push(`${qi(k)} = $${startIdx + values.length - 1}`);
    }
  } else {
    if (typeof key.__ctid !== 'string') throw new HttpError(400, 'У таблицы нет первичного ключа');
    values.push(key.__ctid); parts.push(`ctid = $${startIdx + values.length - 1}::tid`);
  }
  return { sql: parts.join(' and '), values };
}

export type CellValue = { v?: string | null; null?: boolean; def?: boolean };
