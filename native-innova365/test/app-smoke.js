'use strict';
/**
 * «Дымовой» тест НАСТОЯЩЕГО Electron:  npm run test:app   (запускать там, где Electron установлен).
 *
 * Поднимает фальшивую «кассу» (http-сервер на 127.0.0.2), запускает настоящее приложение с временной папкой данных и проверяет то,
 * что нельзя проверить без реального Chromium:
 *   1. страница открывается, ей доступен только мост innovaNative (моста настроек innova — нет);
 *   2. страница обращается к встроенному агенту печати (CORS, источник кассы разрешён автоматически);
 *   3. preload сработал во вложенном кадре (на этом держится «печать без диалога»);
 *   4. сервер пропал → экран «нет связи»; сервер вернулся → касса открывается сама.
 * Принтер не нужен, ничего не печатается. Результат — построчно PASS/FAIL, код выхода 0 или 1.
 */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const HOST = '127.0.0.2';        // не «localhost»: источник должен быть разрешён именно настройкой «адрес кассы»
const results = [];
const check = (name, ok, extra) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 150) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };

/* Подготовка выполняется ДО готовности Electron: флаги Chromium (например, «безопасный контекст» для http://) читаются приложением при старте. */
const rnd = () => 41000 + Math.floor(Math.random() * 18000);
const sitePort = rnd(), agentPort = sitePort + 1;
const siteUrl = `http://${HOST}:${sitePort}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-smoke-'));
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ serverUrl: siteUrl, agent: { port: agentPort, token: 'c'.repeat(36) } }));
process.env.INNOVA_USER_DATA = dir;

const reports = [];
const page = `<!doctype html><meta charset="utf-8"><title>mock</title><body>mock kassa<script>
  (async () => {
    const out = {};
    out.isDesktop = !!(window.innovaNative && window.innovaNative.isDesktop === true);
    out.noSettingsBridge = typeof window.innova === 'undefined';
    out.secureContext = window.isSecureContext;
    try { const r = await fetch('http://127.0.0.1:${agentPort}/health'); const j = await r.json(); out.agent = j.agent === 'innova365' && j.origin === true; }
    catch (e) { out.agent = 'ERR ' + e.message; }
    try { out.printersStatus = (await fetch('http://127.0.0.1:${agentPort}/printers')).status; } catch (e) { out.printersStatus = 'ERR ' + e.message; }
    const f = document.createElement('iframe'); document.body.appendChild(f);
    await new Promise((r) => setTimeout(r, 400));
    try { out.iframePatched = String(f.contentWindow.print).indexOf('__innovaPrintHtml') !== -1; } catch (e) { out.iframePatched = 'ERR ' + e.message; }
    await fetch('/report', { method: 'POST', body: JSON.stringify(out) });
  })();
  </script>`;

const mk = () => http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/report') { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { try { reports.push(JSON.parse(b)); } catch { /* пусто */ } res.end('ok'); }); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page);
});
let server = mk();
server.listen(sitePort, '0.0.0.0');
require('../src/main');        // настоящее приложение

async function main() {
  const mainWin = () => BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith(siteUrl));
  const win = await until(() => mainWin(), 15000);
  check('окно кассы создано и открыло адрес из настроек', !!win);
  const r1 = await until(() => reports[0], 20000);
  check('страница выполнила проверки (получен отчёт)', !!r1);
  if (r1) {
    check('сайту доступен innovaNative.isDesktop', r1.isDesktop === true, r1.isDesktop);
    check('мост настроек (innova) сайту НЕ доступен', r1.noSettingsBridge === true, r1.noSettingsBridge);
    check('страница по http:// считается безопасным контекстом (WebUSB)', r1.secureContext === true, r1.secureContext);
    check('агент печати отвечает странице кассы (CORS, источник разрешён автоматически)', r1.agent === true, r1.agent);
    check('агент отдаёт список принтеров странице кассы', r1.printersStatus === 200, r1.printersStatus);
    check('preload сработал во вложенном кадре (переопределён window.print)', r1.iframePatched === true, r1.iframePatched);
  }

  // сервер пропал → экран «нет связи»
  await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
  const w = mainWin() || BrowserWindow.getAllWindows()[0];
  w.webContents.reload();
  const offline = await until(() => w.webContents.getURL().includes('offline.html'), 15000);
  check('при недоступном сервере открывается экран «нет связи»', !!offline, w.webContents.getURL());

  // сервер вернулся → касса открывается сама (повтор каждые 5 с)
  server = mk(); await new Promise((r) => server.listen(sitePort, '0.0.0.0', r));
  const back = await until(() => w.webContents.getURL().startsWith(siteUrl), 20000, 300);
  check('когда сервер вернулся, касса открылась автоматически', !!back, w.webContents.getURL());

  await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed} / ${results.length}`);
  app.exit(failed ? 1 : 0);
}

app.whenReady().then(() => main().catch((e) => { console.error('FAIL  smoke crashed:', e); app.exit(1); }));
setTimeout(() => { console.error('FAIL  тайм-аут теста (90 с)'); app.exit(1); }, 90_000).unref();
