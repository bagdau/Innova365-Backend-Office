'use strict';
/**
 * Очередь печати, которая переживает сбой принтера и перезапуск кассы.
 * Задание лежит файлом в каталоге очереди, пока не напечатано или не истёк срок (чек через час уже не нужен).
 * Печать не блокирует продажу: enqueue возвращается сразу, отправка идёт в фоне с повторами.
 * Без зависимостей от Electron.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PrintQueue {
  /** @param {{dir: string, router: {send: Function}, log?: (m: string) => void, retryMs?: number, maxAgeMs?: number, now?: () => number}} o */
  constructor({ dir, router, log = () => undefined, retryMs = 10_000, maxAgeMs = 15 * 60_000, now = Date.now }) {
    this.dir = dir; this.router = router; this.log = log; this.retryMs = retryMs; this.maxAgeMs = maxAgeMs; this.now = now;
    this.timer = null; this.busy = false; this.failed = []; this.seq = 0;
    fs.mkdirSync(dir, { recursive: true });
  }

  _meta(id) { return path.join(this.dir, id + '.json'); }
  _bin(id) { return path.join(this.dir, id + '.bin'); }

  /** Ставит задание в очередь и пробует отправить сразу. Дубликат с тем же key не печатается повторно. */
  async enqueue(printer, data, { key } = /** @type {{key?: string}} */ ({})) {
    const id = key ? crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 16) : crypto.randomBytes(8).toString('hex');
    if (fs.existsSync(this._meta(id))) return { id, queued: true, duplicate: true };
    fs.writeFileSync(this._bin(id), data);
    fs.writeFileSync(this._meta(id), JSON.stringify({ id, printer, createdAt: this.now(), seq: ++this.seq, tries: 0, lastError: '' }));
    await this.pump();
    return { id, queued: fs.existsSync(this._meta(id)) };
  }

  /** Задания в очереди (ожидают повтора). */
  list() {
    return fs.readdirSync(this.dir).filter((f) => f.endsWith('.json')).map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8')); } catch { return null; }
    }).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt || (a.seq ?? 0) - (b.seq ?? 0));
  }

  _drop(id) { fs.rmSync(this._meta(id), { force: true }); fs.rmSync(this._bin(id), { force: true }); }

  /** Один проход по очереди: по порядку создания, чтобы чеки не менялись местами. */
  async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const job of this.list()) {
        if (this.now() - job.createdAt > this.maxAgeMs) {
          this.failed.push({ ...job, expired: true }); this.failed = this.failed.slice(-20);
          this.log(`[queue] задание ${job.id} для «${job.printer}» просрочено: ${job.lastError || 'нет ответа'}`);
          this._drop(job.id); continue;
        }
        try {
          await this.router.send(job.printer, fs.readFileSync(this._bin(job.id)));
          this._drop(job.id);
        } catch (e) {
          job.tries += 1; job.lastError = e.message;
          fs.writeFileSync(this._meta(job.id), JSON.stringify(job));
          if (e.code === 'not_found') { this.failed.push({ ...job, notFound: true }); this._drop(job.id); }
        }
      }
    } finally { this.busy = false; }
  }

  start() { if (!this.timer) { this.timer = setInterval(() => void this.pump(), this.retryMs); this.timer.unref?.(); void this.pump(); } }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}

module.exports = { PrintQueue };
