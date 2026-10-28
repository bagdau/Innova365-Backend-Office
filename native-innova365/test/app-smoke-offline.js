'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.INNOVA_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-offline-ui-'));
process.env.INNOVA_OFFLINE_POS = '1';
require('../src/main');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  let main = null;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    main = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.getTitle() === 'Innova365' && /^http:\/\/127\.0\.0\.1:/.test(w.webContents.getURL()));
    if (main && main.webContents.getURL().includes('/login')) break;
    await sleep(250);
  }
  if (!main || !main.webContents.getURL().includes('/login')) throw new Error('Локальный экран входа не открылся');
  const result = await main.webContents.executeJavaScript(`(async () => {
    const health = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.invalid', password: 'bad-password' }) });
    return { title: document.title, login: !!document.querySelector('input'), native: !!window.innovaNative?.isDesktop, status: health.status, origin: location.origin };
  })()`, true);
  if (!result.login || !result.native || result.status !== 401 || !result.origin.startsWith('http://127.0.0.1:')) throw new Error(JSON.stringify(result));
  process.stdout.write('PASS local Electron login + local API: ' + JSON.stringify(result) + '\n');
  app.quit();
})().catch((error) => { process.stderr.write('FAIL ' + String(error.stack || error) + '\n'); process.exitCode = 1; app.quit(); });
