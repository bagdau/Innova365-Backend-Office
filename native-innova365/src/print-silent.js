// @ts-check
'use strict';
/**
 * Печать HTML-документа без диалога: документ открывается в скрытом окне (без JavaScript) и уходит на принтер.
 * Печатает локальный документ через драйвер Windows. Результат означает передачу задания драйверу,
 * а не подтверждение физической печати.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const electron = require('electron');

const TIMEOUT_MS = 30_000;

/**
 * @param {string} html
 * @param {{deviceName?: string, page?: {widthMm:number,heightMm:number}, log?: (m: string) => void}} [opts]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function printHtmlSilent(html, { deviceName = '', page, log = () => undefined } = {}) {
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
    await new Promise((r) => setTimeout(r, 400));       // даём дорисоваться шрифтам и картинкам
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), TIMEOUT_MS);
      const options = { silent: true, printBackground: true, deviceName, margins: { marginType: /** @type {const} */ ('none') },
        ...(page ? { pageSize: { width: Math.round(page.widthMm * 1000), height: Math.round(page.heightMm * 1000) } } : {}) };
      win.webContents.print(options, (success, reason) => {
        clearTimeout(timer);
        resolve(success ? { ok: true } : { ok: false, error: reason || 'print failed' });
      });
    });
    log(`[print-html] ${/** @type {any} */ (result).ok ? 'ok' : 'ошибка: ' + /** @type {any} */ (result).error} (принтер: ${deviceName || 'по умолчанию'})`);
    return /** @type {{ok: boolean, error?: string}} */ (result);
  } catch (e) {
    return { ok: false, error: /** @type {Error} */ (e).message };
  } finally {
    // Chromium can call back before the driver finishes consuming the rendered page.
    // Destroying the window immediately caused empty or truncated jobs on some queues.
    setTimeout(cleanup, 3000).unref?.();
  }
}

module.exports = { printHtmlSilent };
