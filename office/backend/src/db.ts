import fs from 'fs';
import path from 'path';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

/** Один пул на сервис — подключение к ТОЙ ЖЕ базе, что и основная система Innova365. */
export const pool = new Pool({ connectionString: config.databaseUrl, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8000, application_name: 'innova-office' });
pool.on('error', (e) => console.error('[pg pool]', e.message));
// числа и даты отдаём как есть: numeric → строка (потом приводим к Number там, где это нужно), date → 'YYYY-MM-DD'
import { types } from 'pg';
types.setTypeParser(1082, (v: string) => v);
// Prisma хранит DateTime в public как TIMESTAMP без часового пояса, но значения в UTC.
// Стандартный pg читает их в TZ процесса (у Office это часовой пояс заведения), сдвигая время.
types.setTypeParser(1114, (v: string) => new Date(v.replace(' ', 'T') + 'Z'));

export async function q<T extends QueryResultRow = any>(text: string, values: unknown[] = []): Promise<T[]> {
  const r = await pool.query<T>({ text, values: values as any[] });
  return r.rows;
}
export async function q1<T extends QueryResultRow = any>(text: string, values: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, values))[0];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => undefined);
    throw e;
  } finally { c.release(); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ждём, пока основная система создаст свои таблицы (миграции Prisma при старте backend), затем применяем свои миграции. */
export async function migrate(): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      const r = await q(`select to_regclass('public."Restaurante"') as a, to_regclass('public."Receta"') as b, to_regclass('public."MovimientoInventario"') as c`);
      if (r[0].a && r[0].b && r[0].c) break;
      if (i >= 60) throw new Error('таблицы основной системы не найдены: запустите backend основной системы');
    } catch (e) {
      if (i >= 60) throw e;
    }
    if (i === 0) console.log('[migrate] жду таблицы основной системы…');
    await sleep(2000);
  }
  const c = await pool.connect();
  try {
    await c.query('select pg_advisory_lock(727301)');
    await c.query('create schema if not exists office');
    await c.query('create table if not exists office.schema_migrations (id text primary key, applied_at timestamptz not null default now())');
    const dir = path.resolve(config.migrationsDir);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      const done = await c.query('select 1 from office.schema_migrations where id = $1', [f]);
      if (done.rowCount) continue;
      console.log('[migrate] применяю', f);
      await c.query('begin');
      try {
        await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await c.query('insert into office.schema_migrations (id) values ($1)', [f]);
        await c.query('commit');
      } catch (e) { await c.query('rollback'); throw e; }
    }
  } finally {
    await c.query('select pg_advisory_unlock(727301)').catch(() => undefined);
    c.release();
  }
}
