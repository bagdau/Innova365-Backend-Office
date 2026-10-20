import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { config } from './config';

/**
 * Сессия = вход под настоящей учётной записью PostgreSQL (как в phpMyAdmin).
 * Пароль хранится только в памяти процесса, в cookie лежит случайный идентификатор.
 */
export interface Session {
  id: string;
  user: string;
  password: string;
  defaultDb: string;
  pools: Map<string, Pool>;
  readOnly: boolean;
  isSuper: boolean;
  version: string;
  ip: string;
  created: number;
  lastSeen: number;
}

const sessions = new Map<string, Session>();

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

function makePool(user: string, password: string, database: string): Pool {
  const pool = new Pool({
    host: config.dbHost, port: config.dbPort, user, password, database,
    max: 5, idleTimeoutMillis: 60_000, connectionTimeoutMillis: 6000,
    application_name: 'innova-dbstudio',
  });
  pool.on('error', () => { /* оборванное соединение в пуле — не роняем процесс */ });
  return pool;
}

export async function login(user: string, password: string, db: string, ip: string): Promise<Session> {
  if (sessions.size >= config.maxSessions) {
    const oldest = [...sessions.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0];
    if (oldest) await destroy(oldest.id);
  }
  const pool = makePool(user, password, db);
  let info;
  try {
    info = await pool.query(`select current_user as u, version() as v, (select rolsuper from pg_roles where rolname = current_user) as su`);
  } catch (e) {
    await pool.end().catch(() => undefined);
    throw e;
  }
  const s: Session = {
    id: crypto.randomBytes(32).toString('hex'), user, password, defaultDb: db,
    pools: new Map([[db, pool]]), readOnly: true,
    isSuper: !!info.rows[0].su, version: String(info.rows[0].v), ip,
    created: Date.now(), lastSeen: Date.now(),
  };
  sessions.set(s.id, s);
  return s;
}

export function getSession(id: string | undefined): Session | null {
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.lastSeen > config.idleMinutes * 60_000) { void destroy(id); return null; }
  s.lastSeen = Date.now();
  return s;
}

export async function destroy(id: string): Promise<void> {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  await Promise.all([...s.pools.values()].map((p) => p.end().catch(() => undefined)));
}

setInterval(() => {
  for (const s of sessions.values()) if (Date.now() - s.lastSeen > config.idleMinutes * 60_000) void destroy(s.id);
}, 60_000).unref();

export function poolFor(s: Session, db?: string): Pool {
  const name = db || s.defaultDb;
  let p = s.pools.get(name);
  if (!p) { p = makePool(s.user, s.password, name); s.pools.set(name, p); }
  return p;
}

/** Закрыть пулы сессии ко всем базам, кроме указанной (нужно перед DROP DATABASE: иначе PostgreSQL ответит «база занята»). */
export async function closeOtherPools(s: Session, keepDb: string): Promise<void> {
  for (const [name, pool] of [...s.pools.entries()]) {
    if (name !== keepDb) { s.pools.delete(name); await pool.end().catch(() => undefined); }
  }
}

/** Строка «user:password» для передачи в pg_dump / psql через окружение дочернего процесса. */
export function pgEnv(s: Session, db?: string): NodeJS.ProcessEnv {
  return { ...process.env, PGHOST: config.dbHost, PGPORT: String(config.dbPort), PGUSER: s.user, PGPASSWORD: s.password, PGDATABASE: db || s.defaultDb };
}

/** Получить соединение с настройками сессии (режим чтения/записи, таймаут). После работы состояние сбрасывается. */
export async function withClient<T>(
  s: Session, db: string | undefined, fn: (c: PoolClient) => Promise<T>,
  opts: { timeoutMs?: number; forceWrite?: boolean } = {},
): Promise<T> {
  const pool = poolFor(s, db);
  const c = await pool.connect();
  let broken: Error | undefined;
  try {
    const ro = opts.forceWrite ? false : s.readOnly;
    await c.query(`SET statement_timeout = ${Math.floor(opts.timeoutMs ?? config.statementTimeoutMs)}`);
    await c.query(`SET default_transaction_read_only = ${ro ? 'on' : 'off'}`);
    return await fn(c);
  } finally {
    // пользователь мог оставить открытую транзакцию или SET — тогда соединение выбрасываем
    try { await c.query('DISCARD ALL'); } catch (e) { broken = e as Error; }
    c.release(broken);
  }
}

/** Безопасное экранирование идентификатора. */
export const qi = (s: string): string => '"' + s.replace(/"/g, '""') + '"';

/** Парсер типов: все значения возвращаем строками в текстовом формате PostgreSQL (без потери точности). */
export const RAW_TYPES = { getTypeParser: () => (v: string) => v } as unknown as import('pg').CustomTypesConfig;
