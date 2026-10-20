#!/usr/bin/env node
/**
 * Агент печати Innova365.
 *
 * Запускается на компьютере, к которому подключён принтер (USB или установленный в Windows),
 * и принимает «сырые» ESC/POS-данные от сервера Innova365:
 *
 *   GET  /health                      — проверка, что агент жив (без токена)
 *   GET  /printers                    — список принтеров Windows        (заголовок X-Token)
 *   POST /print?printer=<имя>         — тело = байты ESC/POS             (заголовок X-Token)
 *
 * Без внешних зависимостей: нужен только Node.js 18+. Windows (winspool RAW) и Linux/macOS (CUPS, lp -o raw).
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const PORT = Number(process.env.PORT || 9101);
const MAX_BODY = 2 * 1024 * 1024;
const TOKEN_FILE = path.join(__dirname, 'agent-token.txt');

// ───────── токен доступа ─────────
function loadToken() {
  if (process.env.PRINT_AGENT_TOKEN) return process.env.PRINT_AGENT_TOKEN;
  try { const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); if (t) return t; } catch { /* создадим */ }
  const t = crypto.randomBytes(18).toString('hex');
  fs.writeFileSync(TOKEN_FILE, t + '\n', { mode: 0o600 });
  return t;
}
const TOKEN = loadToken();
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(TOKEN);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ───────── Windows: постоянный PowerShell-процесс ─────────
let worker = null;
let nextId = 1;
const pending = new Map();
let buf = '';

function startWorker() {
  worker = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'raw-worker.ps1')], { windowsHide: true });
  worker.stdout.setEncoding('utf8');
  worker.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.ready) continue;
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); clearTimeout(p.timer); msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error || 'print error')); }
    }
  });
  worker.stderr.on('data', (d) => console.error('[ps]', String(d).trim()));
  worker.on('exit', () => {
    for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error('print worker stopped')); }
    pending.clear(); worker = null; buf = '';
  });
}

function ask(cmd) {
  if (!worker) startWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, 15000);
    pending.set(id, { resolve, reject, timer });
    worker.stdin.write(JSON.stringify({ id, ...cmd }).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + '\n');
  });
}

// ───────── Linux / macOS: CUPS ─────────
const run = (file, args) => new Promise((resolve, reject) => execFile(file, args, { timeout: 15000 }, (e, out, err) => (e ? reject(new Error(String(err || e.message).trim())) : resolve(String(out)))));

async function listPrinters() {
  if (process.platform === 'win32') return ask({ cmd: 'list' });
  const out = await run('lpstat', ['-e']).catch(() => '');
  return out.split('\n').filter(Boolean).map((name) => ({ name, port: '', driver: 'CUPS', isDefault: false, offline: false }));
}

async function printRaw(printer, file) {
  if (process.platform === 'win32') return ask({ cmd: 'print', printer, file });
  await run('lp', ['-d', printer, '-o', 'raw', file]);
}

// ───────── HTTP ─────────
const json = (res, status, body) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, host: os.hostname(), platform: process.platform, version: '1.0.0' });
    }
    if (!safeEqual(req.headers['x-token'], TOKEN)) return json(res, 401, { error: 'bad token' });

    if (req.method === 'GET' && url.pathname === '/printers') return json(res, 200, await listPrinters());

    if (req.method === 'POST' && url.pathname === '/print') {
      const printer = url.searchParams.get('printer');
      if (!printer) return json(res, 400, { error: 'printer is required' });
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > MAX_BODY) return json(res, 413, { error: 'too large' }); chunks.push(c); }
      const file = path.join(os.tmpdir(), `innova365-${crypto.randomBytes(6).toString('hex')}.bin`);
      fs.writeFileSync(file, Buffer.concat(chunks));
      const t0 = Date.now();
      try {
        await printRaw(printer, file);
        console.log(`[print] "${printer}" ${size} bytes ${Date.now() - t0} ms`);
        return json(res, 200, { ok: true, ms: Date.now() - t0 });
      } finally { fs.unlink(file, () => undefined); }
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('[error]', e.message);
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('────────────────────────────────────────────');
  console.log(' Innova365 · агент печати запущен');
  console.log(` Порт:   ${PORT}`);
  console.log(` Токен:  ${TOKEN}`);
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(` Адрес для Innova365:  http://${ips[0] || 'IP-этого-компьютера'}:${PORT}`);
  console.log('────────────────────────────────────────────');
  if (process.platform === 'win32') startWorker();
});

process.on('SIGINT', () => { if (worker) worker.kill(); process.exit(0); });
