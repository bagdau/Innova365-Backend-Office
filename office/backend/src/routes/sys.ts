import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { config } from '../config';
import { pool, q, q1 } from '../db';
import { liveState } from '../events';
import { ah, HttpError, n, parse, round2 } from '../util';

/**
 * Состояние системы и резервные копии. Копия = полный дамп БД (pg_dump, формат custom) + архив вложений.
 * Расписание работает внутри сервиса Office; восстановление выполняется вручную (см. инструкцию на странице) — это сознательно:
 * подмена рабочей базы из веб-интерфейса слишком опасна.
 */
export const router = Router();
router.use('/sys', auth);

const startedAt = Date.now();
const backupDir = () => path.resolve(config.dataDir, 'backups');

/* ───────── Настройки копирования ───────── */
interface BackupCfg { enabled: boolean; time: string; keep: number }
async function backupCfg(rid: string): Promise<BackupCfg> {
  const rows = await q<{ key: string; value: unknown }>(`select key, value from office.setting where restaurante_id = $1 and key like 'backup.%'`, [rid]);
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const time = String(m.get('backup.time') ?? '03:30');
  return { enabled: m.get('backup.enabled') === undefined ? true : !!m.get('backup.enabled'), time: /^\d{2}:\d{2}$/.test(time) ? time : '03:30', keep: Math.min(90, Math.max(2, Number(m.get('backup.keep') ?? 14))) };
}

/* ───────── Запуск внешних утилит ───────── */
function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = {}, timeoutMs = 20 * 60_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env } });
    let out = '', err = '';
    p.stdout.on('data', (d) => { if (out.length < 200_000) out += d; });
    p.stderr.on('data', (d) => { if (err.length < 20_000) err += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('error', (e) => { clearTimeout(t); resolve({ code: 127, out, err: e.message }); });
    p.on('close', (code) => { clearTimeout(t); resolve({ code: code ?? 1, out, err }); });
  });
}

function dbConn() {
  const u = new URL(config.databaseUrl);
  return { host: u.hostname, port: u.port || '5432', user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), db: u.pathname.replace(/^\//, '') };
}

const pgToolsOk = async () => (await run('pg_dump', ['--version'])).code === 0;

/* ───────── Резервное копирование ───────── */
let running = false;

export async function createBackup(rid: string, by: string, auto: boolean): Promise<{ id: string; ok: boolean; error?: string }> {
  if (running) throw new HttpError(409, 'Копирование уже выполняется');
  running = true;
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(/\D/g, '').replace(/^(\d{8})/, '$1-');
  const row = await q1<{ id: string }>(`insert into office.backup (restaurante_id, stamp, status, auto, created_by_name) values ($1,$2,'running',$3,$4) returning id`, [rid, stamp, auto, by]);
  const id = row!.id;
  try {
    if (!(await pgToolsOk())) throw new Error('В сервисе не установлены утилиты PostgreSQL (pg_dump). Пересоберите образ office.');
    fs.mkdirSync(backupDir(), { recursive: true });
    const free = fs.statfsSync(backupDir());
    const dbSize = Number((await q1<{ s: string }>('select pg_database_size(current_database()) as s'))?.s ?? 0);
    if (Number(free.bavail) * Number(free.bsize) < dbSize * 2 + 50_000_000) throw new Error('Недостаточно места на диске для копии');
    const c = dbConn();
    const dbFile = `db-${stamp}.dump`;
    const dump = await run('pg_dump', ['-Fc', '-Z', '6', '--no-owner', '-h', c.host, '-p', c.port, '-U', c.user, '-d', c.db, '-f', path.join(backupDir(), dbFile)], { PGPASSWORD: c.password });
    if (dump.code !== 0) throw new Error('pg_dump: ' + (dump.err.trim().split('\n').pop() || 'ошибка'));
    const dbBytes = fs.statSync(path.join(backupDir(), dbFile)).size;
    let filesFile: string | null = null, filesBytes: number | null = null;
    const filesDir = path.resolve(config.dataDir, 'files');
    if (fs.existsSync(filesDir) && fs.readdirSync(filesDir).length) {
      filesFile = `files-${stamp}.tar.gz`;
      const t = await run('tar', ['-czf', path.join(backupDir(), filesFile), '-C', path.resolve(config.dataDir), 'files']);
      if (t.code !== 0) throw new Error('tar: ' + t.err.trim());
      filesBytes = fs.statSync(path.join(backupDir(), filesFile)).size;
    }
    const check = await run('pg_restore', ['-l', path.join(backupDir(), dbFile)]);
    const verified = check.code === 0 && check.out.split('\n').length > 20;
    await q(`update office.backup set status = 'ok', db_file = $2, db_size = $3, files_file = $4, files_size = $5, verified_at = now(), verified_ok = $6 where id = $1`, [id, dbFile, dbBytes, filesFile, filesBytes, verified]);
    await prune(rid);
    return { id, ok: true };
  } catch (e) {
    await q(`update office.backup set status = 'error', error = $2 where id = $1`, [id, (e as Error).message.slice(0, 500)]);
    return { id, ok: false, error: (e as Error).message };
  } finally { running = false; }
}

/** Хранить не больше N последних успешных копий (самую свежую — никогда не удаляем). */
async function prune(rid: string): Promise<void> {
  const cfg = await backupCfg(rid);
  const old = await q<{ id: string; db_file: string | null; files_file: string | null }>(`select id, db_file, files_file from office.backup where restaurante_id = $1 and status = 'ok' order by created_at desc offset $2`, [rid, cfg.keep]);
  for (const o of old) {
    for (const f of [o.db_file, o.files_file]) if (f) fs.rmSync(path.join(backupDir(), path.basename(f)), { force: true });
    await q('delete from office.backup where id = $1', [o.id]);
  }
}

router.get('/sys/backups', need('sys.backup'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const rows = await q('select id, stamp, db_size, files_size, status, error, auto, verified_at, verified_ok, created_by_name, created_at, db_file, files_file from office.backup where restaurante_id = $1 order by created_at desc limit 100', [rid]);
  res.json({
    config: await backupCfg(rid), tools: await pgToolsOk(), running,
    rows: rows.map((r) => ({ id: r.id, stamp: r.stamp, dbSize: r.db_size === null ? null : Number(r.db_size), filesSize: r.files_size === null ? null : Number(r.files_size), hasFiles: !!r.files_file, status: r.status, error: r.error, auto: r.auto, verifiedOk: r.verified_ok, by: r.created_by_name, at: r.created_at })),
  });
}));

router.post('/sys/backups', need('sys.backup'), ah(async (req, res) => {
  const r = await createBackup(req.me!.rid, req.me!.name, false);
  await audit(req, 'backup.create', 'backup', r.id, { ok: r.ok });
  if (!r.ok) throw new HttpError(500, r.error ?? 'Не удалось создать копию');
  res.status(201).json({ id: r.id });
}));

router.put('/sys/backups/config', need('sys.backup'), ah(async (req, res) => {
  const b = parse(z.object({ enabled: z.boolean(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ'), keep: z.number().int().min(2).max(90) }), req.body);
  for (const [k, v] of Object.entries({ 'backup.enabled': b.enabled, 'backup.time': b.time, 'backup.keep': b.keep })) {
    await q(`insert into office.setting (restaurante_id, key, value) values ($1,$2,$3) on conflict (restaurante_id, key) do update set value = excluded.value, updated_at = now()`, [req.me!.rid, k, JSON.stringify(v)]);
  }
  await audit(req, 'backup.config', 'backup', null, b);
  res.json(await backupCfg(req.me!.rid));
}));

async function findBackup(req: { me?: { rid: string }; params: Record<string, string> }) {
  const b = await q1<{ id: string; db_file: string | null; files_file: string | null; status: string }>('select id, db_file, files_file, status from office.backup where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!b) throw new HttpError(404, 'Копия не найдена');
  return b;
}

router.get('/sys/backups/:id/download', need('sys.backup'), ah(async (req, res) => {
  const b = await findBackup(req as never);
  const kind = req.query.kind === 'files' ? 'files' : 'db';
  const f = kind === 'files' ? b.files_file : b.db_file;
  if (!f || b.status !== 'ok') throw new HttpError(404, 'Файл копии недоступен');
  const file = path.join(backupDir(), path.basename(f));
  if (!fs.existsSync(file)) throw new HttpError(404, 'Файл копии утерян на диске');
  await audit(req, 'backup.download', 'backup', b.id, { kind });
  res.download(file, path.basename(f));
}));

router.post('/sys/backups/:id/verify', need('sys.backup'), ah(async (req, res) => {
  const b = await findBackup(req as never);
  if (!b.db_file) throw new HttpError(409, 'Нет файла для проверки');
  const r = await run('pg_restore', ['-l', path.join(backupDir(), path.basename(b.db_file))]);
  const ok = r.code === 0 && r.out.split('\n').length > 20;
  await q('update office.backup set verified_at = now(), verified_ok = $2 where id = $1', [b.id, ok]);
  res.json({ ok });
}));

router.delete('/sys/backups/:id', need('sys.backup'), ah(async (req, res) => {
  const b = await findBackup(req as never);
  for (const f of [b.db_file, b.files_file]) if (f) fs.rmSync(path.join(backupDir(), path.basename(f)), { force: true });
  await q('delete from office.backup where id = $1', [b.id]);
  await audit(req, 'backup.delete', 'backup', b.id);
  res.json({ ok: true });
}));

/** Расписание: раз в минуту проверяем время; копия делается один раз в сутки в заданный час (по часовому поясу ресторана). */
export function startBackupScheduler(): void {
  setInterval(() => {
    void (async () => {
      try {
        const rest = await q1<{ id: string }>('select id from public."Restaurante" order by "creadoEn" limit 1');
        if (!rest || running) return;
        const cfg = await backupCfg(rest.id);
        if (!cfg.enabled) return;
        const s = await getSettings(rest.id);
        const now = new Intl.DateTimeFormat('sv-SE', { timeZone: s.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
        if (now < cfg.time) return;
        const last = await q1<{ d: boolean }>(`select exists(select 1 from office.backup where restaurante_id = $1 and auto and (created_at at time zone $2)::date = (now() at time zone $2)::date) as d`, [rest.id, s.timezone]);
        if (last?.d) return;
        console.log('[backup] плановая копия');
        await createBackup(rest.id, 'расписание', true);
      } catch (e) { console.error('[backup]', (e as Error).message); }
    })();
  }, 60_000).unref();
}

/* ───────── Состояние системы ───────── */
type Status = 'ok' | 'warn' | 'bad';
async function kassaHealth(): Promise<{ ok: boolean; ms: number | null }> {
  const url = process.env.KASSA_URL || 'http://backend:3001';
  const t0 = Date.now();
  try {
    const r = await fetch(url + '/health', { signal: AbortSignal.timeout(2500) });
    return { ok: r.ok, ms: Date.now() - t0 };
  } catch { return { ok: false, ms: null }; }
}

router.get('/sys/health', need('sys.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const t0 = Date.now();
  const ping = await q1<{ v: string }>('select version() as v').catch(() => undefined);
  const latency = Date.now() - t0;
  const [size, conns, tables, printers, activity, lastBackup, kassa] = await Promise.all([
    q1<{ s: string }>('select pg_database_size(current_database()) as s'),
    q1<{ total: number; active: number }>(`select count(*)::int as total, count(*) filter (where state = 'active')::int as active from pg_stat_activity where datname = current_database()`),
    q(`select relname as name, pg_total_relation_size(c.oid) as bytes, c.reltuples::bigint as rows from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where c.relkind = 'r' and ns.nspname in ('public', 'office') order by 2 desc limit 8`),
    q(`select i.id, i.nombre, i.tipo::text as tipo, i.activa,
              (select count(*) filter (where t.ok)::int from public."TrabajoImpresion" t where t."impresoraId" = i.id and t."creadoEn" > now() - interval '24 hours') as ok24,
              (select count(*) filter (where not t.ok)::int from public."TrabajoImpresion" t where t."impresoraId" = i.id and t."creadoEn" > now() - interval '24 hours') as fail24,
              (select t.error from public."TrabajoImpresion" t where t."impresoraId" = i.id and not t.ok order by t."creadoEn" desc limit 1) as last_error,
              (select t.ok from public."TrabajoImpresion" t where t."impresoraId" = i.id order by t."creadoEn" desc limit 1) as last_ok
         from public."Impresora" i where i."restauranteId" = $1 order by i.nombre`, [rid]),
    q1(`select (select max("creadoEn") from public."Pedido" where "restauranteId" = $1) as last_order,
               (select count(*)::int from public."Pedido" where "restauranteId" = $1 and "creadoEn" > now() - interval '1 hour') as orders_hour,
               (select count(*)::int from public."Pedido" where "restauranteId" = $1 and estado in ('PENDIENTE','EN_COCINA','EN_PREPARACION','LISTO','ENTREGADO')) as open_orders`, [rid]),
    q1<{ created_at: string }>(`select created_at from office.backup where restaurante_id = $1 and status = 'ok' order by created_at desc limit 1`, [rid]),
    kassaHealth(),
  ]);
  let disk: { total: number; free: number } | null = null;
  try { const s = fs.statfsSync(path.resolve(config.dataDir)); disk = { total: Number(s.blocks) * Number(s.bsize), free: Number(s.bavail) * Number(s.bsize) }; } catch { /* каталога может не быть */ }

  const checks: { id: string; label: string; status: Status; detail: string }[] = [];
  checks.push({ id: 'db', label: 'База данных', status: ping ? (latency > 500 ? 'warn' : 'ok') : 'bad', detail: ping ? `отвечает за ${latency} мс` : 'нет ответа' });
  checks.push({ id: 'kassa', label: 'Касса (сервер заказов)', status: kassa.ok ? 'ok' : 'bad', detail: kassa.ok ? `отвечает за ${kassa.ms} мс` : 'не отвечает' });
  const live = liveState();
  checks.push({ id: 'events', label: 'Живые обновления', status: live.listening ? 'ok' : 'bad', detail: live.listening ? `поток событий работает, экранов подключено: ${live.clients}` : 'нет связи с каналом уведомлений БД' });
  const badPrinters = printers.filter((p) => p.activa && (p.last_ok === false || p.fail24 > 0));
  checks.push({ id: 'printers', label: 'Принтеры', status: !printers.length ? 'warn' : badPrinters.some((p) => p.last_ok === false) ? 'bad' : badPrinters.length ? 'warn' : 'ok',
    detail: !printers.length ? 'принтеры не настроены' : badPrinters.length ? `проблемы: ${badPrinters.map((p) => p.nombre).join(', ')}` : `исправны: ${printers.filter((p) => p.activa).length}` });
  if (disk) { const freePct = (disk.free / disk.total) * 100; checks.push({ id: 'disk', label: 'Диск (вложения, копии)', status: freePct < 5 ? 'bad' : freePct < 15 ? 'warn' : 'ok', detail: `свободно ${round2(freePct)}%` }); }
  const ageH = lastBackup ? (Date.now() - new Date(lastBackup.created_at).getTime()) / 3600_000 : null;
  checks.push({ id: 'backup', label: 'Резервная копия', status: ageH === null ? 'bad' : ageH > 48 ? 'bad' : ageH > 30 ? 'warn' : 'ok', detail: ageH === null ? 'копий ещё нет' : `последняя ${ageH < 1 ? 'менее часа' : Math.round(ageH) + ' ч'} назад` });

  res.json({
    status: checks.some((c) => c.status === 'bad') ? 'bad' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok', checks,
    db: { version: ping?.v?.split(' ').slice(0, 2).join(' ') ?? null, latency, size: Number(size?.s ?? 0), connections: conns, tables: tables.map((t) => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })) },
    office: { uptimeSec: Math.round((Date.now() - startedAt) / 1000), memoryMb: Math.round(process.memoryUsage().rss / 1048576), node: process.version, pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } },
    disk, kassa, live,
    printers: printers.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, activa: p.activa, ok24: p.ok24, fail24: p.fail24, lastError: p.last_error, lastOk: p.last_ok })),
    activity: { lastOrder: activity?.last_order ?? null, ordersLastHour: n(activity?.orders_hour), openOrders: n(activity?.open_orders) },
  });
}));
