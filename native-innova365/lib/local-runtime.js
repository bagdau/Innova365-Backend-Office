// @ts-check
'use strict';
/** Portable PostgreSQL + existing Express backend. All data lives in userData. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

/** @param {string} file @param {string[]} args @param {{cwd?:string,env?:NodeJS.ProcessEnv,timeout?:number,detachOutput?:boolean}} opts */
function run(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: opts.cwd, env: opts.env, windowsHide: true, stdio: opts.detachOutput ? 'ignore' : ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk) => { output = (output + chunk.toString('utf8')).slice(-8000); };
    child.stdout?.on('data', collect); child.stderr?.on('data', collect);
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Превышено время запуска ${path.basename(file)}`)); }, opts.timeout || 120_000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`${path.basename(file)} завершился с кодом ${code}: ${output}`));
    });
  });
}

/** @param {any} error */
function explainInitdbError(error) {
  const text = String(error?.message || error);
  if (/3221225781|0xC0000135|3221225477|0xC0000005/i.test(text) || error?.code === 'ENOENT') {
    return `Не удалось запустить initdb.exe: не хватает системных библиотек Windows. Установите Microsoft Visual C++ Redistributable x64 (https://aka.ms/vs/17/release/vc_redist.x64.exe) и запустите кассу снова.
${text}`;
  }
  if (/administrative|администратор/i.test(text)) return `Запустите кассу обычным двойным кликом, не от имени администратора.
${text}`;
  return `Не удалось создать локальную базу. Если установлен антивирус, добавьте папку установки Innova365 в исключения.
${text}`;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address !== 'string' ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new Error('Не удалось выбрать локальный порт')));
    });
  });
}

/** @param {string} dataDir */
function loadSecrets(dataDir) {
  const file = path.join(dataDir, 'local-secrets.json');
  if (fs.existsSync(file)) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(value.dbPassword || '') || !/^[a-f0-9]{64}$/.test(value.jwtSecret || '') || !/^[a-f0-9]{64}$/.test(value.refreshSecret || '')) throw new Error('Локальные ключи повреждены; восстановите их из резервной копии');
    return value;
  }
  const value = { dbPassword: crypto.randomBytes(32).toString('hex'), jwtSecret: crypto.randomBytes(32).toString('hex'), refreshSecret: crypto.randomBytes(32).toString('hex') };
  fs.mkdirSync(dataDir, { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
  return value;
}

/** @param {string} url @param {number} timeoutMs */
async function waitHealth(url, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (response.ok) return; } catch { /* процесс ещё запускается */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Локальный backend не запустился за 30 секунд');
}

/** @param {{pgDir:string,backendDir:string,seedPath:string,dataDir:string,execPath:string,manifestPath?:string,log?:(line:string)=>void}} options */
async function startLocalRuntime(options) {
  const { pgDir, backendDir, seedPath, dataDir, execPath, manifestPath, log = () => undefined } = options;
  const manifest = manifestPath ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  if (manifest) {
    if (manifest.format !== 1 || !/^[a-zA-Z0-9_-]{3,100}$/.test(manifest.restaurantId || '') || !/^[a-f0-9]{64}$/.test(manifest.seedSha256 || '')) throw new Error('Неверный паспорт установочного дампа');
    const actual = crypto.createHash('sha256').update(fs.readFileSync(seedPath)).digest('hex');
    if (actual !== manifest.seedSha256) throw new Error('Установочный дамп повреждён или изменён');
  }
  const bin = path.join(pgDir, 'bin');
  const initdb = path.join(bin, 'initdb.exe');
  const pgctl = path.join(bin, 'pg_ctl.exe');
  const psql = path.join(bin, 'psql.exe');
  const pgdump = path.join(bin, 'pg_dump.exe');
  const backendEntry = path.join(backendDir, 'dist', 'server.js');
  const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  for (const file of [initdb, pgctl, psql, pgdump, backendEntry, prismaCli, seedPath]) if (!fs.existsSync(file)) throw new Error(`Отсутствует компонент офлайн-кассы: ${file}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const secrets = loadSecrets(dataDir);
  const cluster = path.join(dataDir, 'postgres');
  const readyMarker = path.join(dataDir, 'bootstrap.done');
  const fresh = !fs.existsSync(path.join(cluster, 'PG_VERSION'));
  if (!fresh && !fs.existsSync(readyMarker)) throw new Error('Первичная загрузка базы была прервана. Сохраните папку данных и повторите установку на чистой базе.');
  const pgPort = /** @type {number} */ (await freePort());
  const apiPort = /** @type {number} */ (await freePort());
  if (pgPort === apiPort) throw new Error('Порты локальных служб совпали');
  const dbEnv = { ...process.env, PGPASSWORD: secrets.dbPassword };
  let pgStarted = false;
  /** @type {import('node:child_process').ChildProcess | null} */ let backend = null;
  const backup = () => {
    const backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const temp = path.join(backupDir, `backup-${stamp}.dump.tmp`);
    const dest = temp.slice(0, -4);
    const result = spawnSync(pgdump, ['-Fc', '-h', '127.0.0.1', '-p', String(pgPort), '-U', 'innova', '-d', 'postgres', '-f', temp],
      { cwd: pgDir, env: dbEnv, windowsHide: true, timeout: 120_000 });
    if (result.status === 0) {
      fs.renameSync(temp, dest);
      const files = fs.readdirSync(backupDir).filter((name) => /^backup-.*\.dump$/.test(name)).sort();
      for (const old of files.slice(0, -7)) fs.rmSync(path.join(backupDir, old), { force: true });
      log(`[offline] резервная копия сохранена: ${dest}`);
    } else { fs.rmSync(temp, { force: true }); log(`[offline] резервная копия не создана: ${String(result.stderr).slice(0, 500)}`); }
  };
  try {
    if (fresh) {
      const passwordFile = path.join(dataDir, 'pg-password.tmp');
      fs.writeFileSync(passwordFile, secrets.dbPassword + '\n', { mode: 0o600 });
      try { await run(initdb, ['-D', cluster, '-U', 'innova', '--encoding=UTF8', '--locale=C', '--auth-host=scram-sha-256', '--pwfile', passwordFile], { cwd: pgDir, timeout: 120_000 }); }
      catch (error) { throw new Error(explainInitdbError(error)); }
      finally { fs.rmSync(passwordFile, { force: true }); }
    }
    // Убираем оставшийся после аварийного выключения процесс этой же локальной БД.
    const status = spawnSync(pgctl, ['status', '-D', cluster], { cwd: pgDir, windowsHide: true });
    if (status.status === 0) await run(pgctl, ['stop', '-D', cluster, '-m', 'fast', '-w', '-t', '30'], { cwd: pgDir, timeout: 40_000, detachOutput: true });
    await run(pgctl, ['start', '-D', cluster, '-l', path.join(dataDir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort}`, '-w', '-t', '30'], { cwd: pgDir, timeout: 40_000, detachOutput: true });
    pgStarted = true;
    const dbUrl = `postgresql://innova:${secrets.dbPassword}@127.0.0.1:${pgPort}/postgres`;
    const env = { ...process.env, DATABASE_URL: dbUrl + '?schema=public&connection_limit=5', DIRECT_URL: dbUrl + '?schema=public',
      JWT_SECRET: secrets.jwtSecret, JWT_REFRESH_SECRET: secrets.refreshSecret, COOKIE_SECURE: 'false',
      PORT: String(apiPort), HOST: '127.0.0.1', INNOVA_LOCAL_MODE: '1', UPLOAD_DIR: path.join(dataDir, 'uploads') };
    if (fresh) {
      await run(psql, ['-X', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(pgPort), '-U', 'innova', '-d', 'postgres', '-f', seedPath], { cwd: pgDir, env: dbEnv, timeout: 180_000 });
      log('[offline] локальные данные заведения восстановлены');
    }
    if (manifest) {
      const id = String(await run(psql, ['-X', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(pgPort), '-U', 'innova', '-d', 'postgres', '-c', 'SELECT id FROM "Restaurante"'], { cwd: pgDir, env: dbEnv, timeout: 15_000 })).trim();
      if (id !== manifest.restaurantId) throw new Error('Локальная база принадлежит другому заведению; данные не изменены');
    }
    await run(execPath, [prismaCli, 'migrate', 'deploy'], { cwd: backendDir, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 120_000 });
    backend = spawn(execPath, [backendEntry], { cwd: backendDir, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    backend.stdout?.on('data', (chunk) => log(`[offline-api] ${String(chunk).trim().slice(0, 500)}`));
    backend.stderr?.on('data', (chunk) => log(`[offline-api] ${String(chunk).trim().slice(0, 500)}`));
    await waitHealth(`http://127.0.0.1:${apiPort}/health`);
    if (fresh) fs.writeFileSync(readyMarker, new Date().toISOString(), { flag: 'wx' });
    log('[offline] локальная база и API готовы');
    let stopped = false;
    return {
      apiUrl: `http://127.0.0.1:${apiPort}`,
      databasePort: pgPort,
      stop: () => {
        if (stopped) return;
        stopped = true;
        backend?.kill();
        try { backup(); } catch (error) { log(`[offline] ошибка резервного копирования: ${String(error)}`); }
        const stopResult = spawnSync(pgctl, ['stop', '-D', cluster, '-m', 'fast', '-w', '-t', '30'], { cwd: pgDir, windowsHide: true, timeout: 40_000 });
        if (stopResult.status !== 0) log(`[offline] ошибка остановки БД: ${String(stopResult.stderr).slice(0, 500)}`);
      },
    };
  } catch (error) {
    backend?.kill();
    if (pgStarted || spawnSync(pgctl, ['status', '-D', cluster], { cwd: pgDir, windowsHide: true }).status === 0) {
      spawnSync(pgctl, ['stop', '-D', cluster, '-m', 'fast', '-w', '-t', '30'], { cwd: pgDir, windowsHide: true, timeout: 40_000 });
    }
    if (fresh) {
      const resolvedCluster = path.resolve(cluster);
      const resolvedDataDir = path.resolve(dataDir);
      if (resolvedCluster.startsWith(resolvedDataDir + path.sep) && path.basename(resolvedCluster) === 'postgres') fs.rmSync(resolvedCluster, { recursive: true, force: true });
    }
    throw error;
  }
}

module.exports = { startLocalRuntime, loadSecrets, freePort };
