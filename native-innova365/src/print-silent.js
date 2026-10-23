// @ts-check
'use strict';
/**
 * Печать HTML-документа без диалога: документ открывается в скрытом окне (без JavaScript) и уходит на принтер.
 * Нужна для документов, которые касса печатает через «окно браузера» (A4, отчёты). Чеки на термопринтер идут отдельным путём — через агент (RAW).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const electron = require('electron');

const TIMEOUT_MS = 30_000;

/**
 * @param {string} html
 * @param {{deviceName?: string, log?: (m: string) => void}} [opts]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function printHtmlSilent(html, { deviceName = '', log = () => undefined } = {}) {
  const { BrowserWindow } = electron;
  const file = path.join(os.tmpdir(), `innova365-doc-${crypto.randomBytes(6).toString('hex')}.html`);
  fs.writeFileSync(file, html, 'utf8');
  const win = new BrowserWindow({
    show: false, width: 800, height: 1000,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, partition: 'innova-print' },
  });
  const cleanup = () => { try { if (!win.isDestroyed()) win.destroy(); } catch { /* ignore */ } fs.unlink(file, () => undefined); };
  try {
    await win.loadFile(file);
    await new Promise((r) => setTimeout(r, 150));       // даём дорисоваться шрифтам и картинкам
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), TIMEOUT_MS);
      win.webContents.print({ silent: true, printBackground: true, deviceName, margins: { marginType: 'none' } }, (success, reason) => {
        clearTimeout(timer);
        resolve(success ? { ok: true } : { ok: false, error: reason || 'print failed' });
      });
    });
    log(`[print-html] ${/** @type {any} */ (result).ok ? 'ok' : 'ошибка: ' + /** @type {any} */ (result).error} (принтер: ${deviceName || 'по умолчанию'})`);
    return /** @type {{ok: boolean, error?: string}} */ (result);
  } catch (e) {
    return { ok: false, error: /** @type {Error} */ (e).message };
  } finally { cleanup(); }
}

module.exports = { printHtmlSilent };
