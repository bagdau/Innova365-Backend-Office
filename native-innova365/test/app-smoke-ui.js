'use strict';
/** Real Electron smoke test for the installed application's first-run activation screen. */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-activation-'));
process.env.INNOVA_USER_DATA = dir;
require('../src/main');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (fn, timeout = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = fn(); if (value) return value; await wait(100); }
  return null;
};
(async () => {
  const win = await until(() => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().includes('activation.html')));
  if (!win) throw new Error('Activation window did not open');
  await wait(500);
  const result = await win.webContents.executeJavaScript(`(async () => {
    const input = document.getElementById('code');
    input.value = 'abcd-efgh-jklm';
    input.dispatchEvent(new Event('input'));
    const state = await window.innova.state();
    const bad = await window.innova.activate('bad');
    await window.innova.save({ serverUrl: 'https://evil.example' });
    return { title: document.title, code: input.value, first: state.first, bad: bad.ok, hostInput: !!document.getElementById('f_server'), logo: !!document.querySelector('img.brand-image'), stillUnactivated: (await window.innova.state()).first };
  })()`, true);
  if (!(result.first && !result.bad && !result.hostInput && result.logo && result.stillUnactivated && result.code === 'ABCD-EFGH-JKLM')) throw new Error(JSON.stringify(result));
  const shot = process.env.SHOTS ? path.join(process.env.SHOTS, 'activation.png') : path.join(dir, 'activation.png');
  fs.mkdirSync(path.dirname(shot), { recursive: true });
  fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
  console.log('PASS activation screen:', shot);
  console.log('PASS no host selector; manually saving an arbitrary URL cannot activate');
  app.quit();
})().catch((error) => { console.error('FAIL', error); process.exitCode = 1; app.quit(); });
