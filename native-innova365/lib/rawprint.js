'use strict';
/**
 * Отправка «сырых» байтов ESC/POS на принтер.
 *  Windows: постоянный процесс PowerShell (ps/raw-worker.ps1) вызывает winspool RAW — драйвер печати не искажает команды.
 *  Linux/macOS: CUPS (lp -o raw).
 *  Сеть: ретрансляция на порт 9100 принтера в локальной сети.
 * Без зависимостей от Electron: каталог со скриптом передаётся снаружи.
 */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { classifyAll } = require('./printers');

const ASK_TIMEOUT = 15_000;

/** Win32_Printer.DetectedErrorState → текст для оператора (3 «бумага заканчивается» не считается неисправностью). */
const ERROR_TEXT = { 4: 'нет бумаги', 3: 'бумага заканчивается', 7: 'открыта крышка', 8: 'замятие бумаги', 9: 'принтер не отвечает', 10: 'нужно обслуживание', 11: 'лоток переполнен' };
function describeStatus(s) {
  const text = ERROR_TEXT[s.errorState] || (s.workOffline ? 'принтер отключён (работает автономно)' : s.stuckJobs ? 'задание застряло в очереди Windows' : '');
  return { ...s, text, problem: !!text && s.errorState !== 3 };
}

class RawPrinter {
  /** @param {{psDir: string, platform?: string, spawnFn?: Function, execFn?: Function}} o */
  constructor({ psDir, platform = process.platform, spawnFn = spawn, execFn = execFile }) {
    this.psDir = psDir; this.platform = platform; this.spawnFn = spawnFn; this.execFn = execFn;
    this.worker = null; this.nextId = 1; this.pending = new Map(); this.buf = '';
  }

  /* ───────── Windows: процесс PowerShell ───────── */
  _start() {
    const script = path.join(this.psDir, 'raw-worker.ps1');
    const w = this.spawnFn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
    this.worker = w; this.buf = '';
    w.stdout.setEncoding('utf8');
    w.stdout.on('data', (chunk) => {
      this.buf += chunk;
      let i;
      while ((i = this.buf.indexOf('\n')) !== -1) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.ready) continue;
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); clearTimeout(p.timer); msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error || 'print error')); }
      }
    });
    w.stderr.on('data', () => undefined);
    const fail = (why) => { for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(why)); } this.pending.clear(); if (this.worker === w) { this.worker = null; this.buf = ''; } };
    w.on('exit', () => fail('print worker stopped'));
    w.on('error', (e) => fail('print worker: ' + e.message));
  }

  _ask(cmd) {
    if (!this.worker) this._start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('timeout')); }, ASK_TIMEOUT);
      this.pending.set(id, { resolve, reject, timer });
      // только ASCII в канале: не зависит от кодировки консоли PowerShell
      const line = JSON.stringify({ id, ...cmd }).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
      this.worker.stdin.write(line + '\n');
    });
  }

  _run(file, args) {
    return new Promise((resolve, reject) => this.execFn(file, args, { timeout: ASK_TIMEOUT }, (e, out, err) => (e ? reject(new Error(String(err || e.message).trim())) : resolve(String(out)))));
  }

  /* ───────── Публичный интерфейс ───────── */
  /** Принтеры операционной системы с оценкой пригодности. */
  async list() {
    if (this.platform === 'win32') return classifyAll(await this._ask({ cmd: 'list' }));
    const out = await this._run('lpstat', ['-e']).catch(() => '');
    return classifyAll(out.split('\n').filter(Boolean).map((name) => ({ name, port: '', driver: 'CUPS', isDefault: false, offline: false })));
  }

  /** Состояние очереди Windows: бумага, автономный режим, число и ошибки заданий. На других ОС — null. */
  async status(printerName) {
    if (this.platform !== 'win32') return null;
    return describeStatus(await this._ask({ cmd: 'status', printer: printerName }));
  }

  /** Отправляет буфер на принтер ОС по имени. */
  async print(printerName, data) {
    const file = path.join(os.tmpdir(), `innova365-${crypto.randomBytes(6).toString('hex')}.bin`);
    fs.writeFileSync(file, data);
    try {
      if (this.platform === 'win32') await this._ask({ cmd: 'print', printer: printerName, file });
      else await this._run('lp', ['-d', printerName, '-o', 'raw', file]);
    } finally { fs.unlink(file, () => undefined); }
  }

  /** Ретрансляция на сетевой принтер (RAW 9100). Проверка адреса — на вызывающей стороне. */
  relay(host, port, data, { connectMs = 3000, settleMs = 150 } = {}) {
    return new Promise((/** @type {(v?: any) => void} */ resolve, reject) => {
      const s = net.connect({ host, port });
      let done = false;
      const fin = (/** @type {Error=} */ err) => { if (done) return; done = true; clearTimeout(t); s.destroy(); err ? reject(err) : resolve(); };
      const t = setTimeout(() => fin(new Error(`printer ${host}:${port} not reachable`)), connectMs);
      s.once('error', (/** @type {any} */ e) => fin(new Error(`printer ${host}:${port}: ${e.code || e.message}`)));
      s.once('connect', () => { clearTimeout(t); s.write(data, (e) => { if (e) return fin(e); setTimeout(() => fin(undefined), settleMs); }); });
    });
  }

  /** Поиск сетевых принтеров (порт 9100) в подсети a.b.c. */
  discover(subnet, { waitMs = 700, port = 9100 } = {}) {
    const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
    return new Promise((resolve) => {
      const found = []; let left = hosts.length;
      const one = (ip) => {
        const s = net.connect({ host: ip, port });
        let closed = false;
        const end = (ok) => { if (closed) return; closed = true; if (ok) found.push(ip); s.destroy(); if (--left === 0) resolve(found.sort((a, b) => Number(a.split('.')[3]) - Number(b.split('.')[3]))); };
        s.setTimeout(waitMs, () => end(false)); s.once('connect', () => end(true)); s.once('error', () => end(false));
      };
      hosts.forEach(one);
    });
  }

  close() {
    if (this.worker) { try { this.worker.kill(); } catch { /* ignore */ } this.worker = null; }
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error('closed')); }
    this.pending.clear();
  }
}

module.exports = { RawPrinter, describeStatus };
