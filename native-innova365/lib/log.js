'use strict';
/** Журнал: кольцевой буфер в памяти (для окна «О программе») + файл с ротацией. Без зависимостей от Electron. */
const fs = require('fs');
const path = require('path');

/** @param {{dir?: string, maxFile?: number, keepLines?: number, now?: () => Date}} [o] */
function createLogger({ dir, maxFile = 1024 * 1024, keepLines = 300, now = () => new Date() } = {}) {
  const ring = [];
  let file = null;
  if (dir) { try { fs.mkdirSync(dir, { recursive: true }); file = path.join(dir, 'app.log'); } catch { file = null; } }

  function rotate() {
    if (!file) return;
    try { if (fs.statSync(file).size > maxFile) fs.renameSync(file, file + '.1'); } catch { /* файла ещё нет */ }
  }

  function log(message) {
    const line = `${now().toISOString()} ${String(message).replace(/[\r\n]+/g, ' ')}`;
    ring.push(line);
    if (ring.length > keepLines) ring.splice(0, ring.length - keepLines);
    if (file) { try { rotate(); fs.appendFileSync(file, line + '\n'); } catch { /* журнал не должен ронять приложение */ } }
  }
  log.lines = () => [...ring];
  log.file = () => file;
  return log;
}

module.exports = { createLogger };
