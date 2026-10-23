'use strict';
/**
 * Сквозной тест окон НАСТОЯЩЕГО Electron:  npm run test:ui
 * Первый запуск → мастер → окно кассы → настройки по Ctrl+Shift+S → реальные вызовы IPC (contextBridge ↔ главный процесс) → PIN и блокировка.
 * Снимки экранов складываются в папку из переменной SHOTS (по умолчанию — временная). Принтер не нужен, ничего не печатается.
 */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const rnd = () => 41000 + Math.floor(Math.random() * 18000);
const sitePort = rnd(), agentPort = sitePort + 1;
const siteUrl = `http://127.0.0.2:${sitePort}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-ui-'));
const shots = process.env.SHOTS || dir;
fs.mkdirSync(shots, { recursive: true });
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ agent: { port: agentPort, token: 'd'.repeat(36) } }));   // адреса кассы нет → первый запуск
process.env.INNOVA_USER_DATA = dir;

const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>mock</title><body style="font:20px sans-serif;padding:40px">Касса (тестовая страница)</body>'); });
server.listen(sitePort, '0.0.0.0');
require('../src/main');

const results = [];
const check = (name, ok, extra) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 120) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
const wins = () => BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
const settingsWin = () => wins().find((w) => w.webContents.getURL().includes('settings.html'));
const mainWin = () => wins().find((w) => w.webContents.getURL().startsWith(siteUrl));
const js = (w, code) => w.webContents.executeJavaScript(code, true);
const shot = async (w, name) => { const img = await w.webContents.capturePage(); fs.writeFileSync(path.join(shots, name + '.png'), img.toPNG()); };
const hotkey = (w, key, mods = {}) => w.webContents.emit('before-input-event', { preventDefault() { /* нет */ } }, { type: 'keyDown', key, control: true, shift: true, ...mods });

async function main() {
  // 1. мастер первого запуска
  const s1 = await until(() => settingsWin(), 15000);
  check('первый запуск: открылось окно настроек (мастер)', !!s1);
  await sleep(600);
  check('в окне настроек есть мост window.innova', (await js(s1, 'typeof window.innova')) === 'object');
  check('мастер виден, основной интерфейс скрыт', (await js(s1, `!document.getElementById('first').classList.contains('hide') && document.getElementById('app').classList.contains('hide')`)) === true);
  check('IPC ui:state отвечает: first=true', (await js(s1, 'window.innova.state().then(s => s.first === true && s.locked === false)')) === true);
  await shot(s1, '1-first-run');
  await js(s1, `document.getElementById('f_server').value = '${siteUrl}'; document.getElementById('f_check').click();`);
  await sleep(1500);
  check('«Проверить адрес» достучалась до фальшивой кассы', (await js(s1, `document.getElementById('f_msg').textContent`)).includes('Сервер отвечает'), await js(s1, `document.getElementById('f_msg').textContent`));
  await js(s1, `document.getElementById('f_go').click()`);
  const m = await until(() => mainWin(), 15000);
  check('после «Сохранить и запустить» открылось окно кассы', !!m);
  check('окно мастера закрылось', await until(() => !settingsWin(), 5000));
  check('адрес записан в config.json', JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).serverUrl === siteUrl);
  if (!m) return;
  await sleep(800);
  await shot(m, '2-main-window');

  // 2. настройки по Ctrl+Shift+S
  hotkey(m, 's');
  const s2 = await until(() => settingsWin(), 8000);
  check('Ctrl+Shift+S открывает настройки', !!s2);
  await sleep(900);
  check('основной интерфейс настроек показан (не мастер)', (await js(s2, `document.getElementById('app').classList.contains('hide') === false && document.getElementById('first').classList.contains('hide')`)) === true);
  check('поля заполнены из настроек', (await js(s2, `document.getElementById('serverUrl').value`)) === siteUrl);
  await shot(s2, '3-settings-connection');
  const st = await js(s2, 'window.innova.state()');
  check('ui:state: версии и папка данных', !!(st.versions && st.versions.electron && st.userData), st.versions);
  check('агент работает (ui:state)', st.agent && st.agent.state === 'running' && st.agent.port === agentPort, st.agent);
  const ta = await js(s2, 'window.innova.testAgent()');
  check('ui:testAgent — агент отвечает', ta.ok === true && ta.health.agent === 'innova365', ta);
  const pr = await js(s2, 'window.innova.printers()');
  check('ui:printers — список принтеров Windows через PowerShell', pr.ok === true && Array.isArray(pr.printers), pr);
  console.log('      принтеров в системе:', pr.printers ? pr.printers.map((p) => p.name + (p.thermal ? ' [чековый]' : '')).join('; ') || '(нет)' : '?');
  const autoTest = await js(s2, `window.innova.testPrint({ printer: 'auto' })`);
  const hasReceipt = pr.printers.some((p) => p.thermal || /(generic|text only)/i.test(p.name));
  if (!hasReceipt) check('пробная печать «Авто» не тратит бумагу на обычный принтер (кассового нет)', autoTest.ok === false && /Кассового принтера|Подходящий/.test(autoTest.error), autoTest);
  else console.log('      есть кассовый принтер — проверку защиты «Авто» пропускаю, чек НЕ печатаю');
  const sp = await js(s2, 'window.innova.systemPrinters()');
  check('ui:systemPrinters', sp.ok === true && Array.isArray(sp.printers), sp);
  const cu = await js(s2, `window.innova.checkUrl('${siteUrl}')`);
  check('ui:checkUrl', cu.ok === true && cu.url === siteUrl, cu);
  const bad = await js(s2, `window.innova.save({ serverUrl: 'javascript:alert(1)' })`);
  check('ui:save отклоняет небезопасный адрес', bad.ok === false, bad);
  const z = await js(s2, `window.innova.save({ zoom: 1.2 })`);
  await sleep(200);
  check('ui:save применяет масштаб к окну кассы', z.ok === true && Math.abs(m.webContents.getZoomFactor() - 1.2) < 0.01, m.webContents.getZoomFactor());
  await js(s2, `document.querySelector('[data-tab=print]').click()`); await sleep(1200);
  await shot(s2, '4-settings-print');
  const rows = await js(s2, `document.querySelectorAll('#printers tr').length`);
  check('вкладка «Печать» показала таблицу принтеров', rows >= 1, rows);
  const over = await js(s2, `(() => { const de = document.documentElement; const m = document.querySelector('main'); const bad = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > m.getBoundingClientRect().right + 1).slice(0, 5).map((e) => e.tagName + '#' + e.id + '.' + e.className + ' r=' + Math.round(e.getBoundingClientRect().right)); return { page: de.scrollWidth - de.clientWidth, main: m.scrollWidth - m.clientWidth, bad }; })()`);
  check('в окне настроек нет горизонтальной прокрутки', over.page <= 0 && over.main <= 0, over);
  await js(s2, `document.querySelector('main').scrollTo(0, 700)`); await sleep(200); await shot(s2, '4b-settings-printers');
  await js(s2, `document.querySelector('[data-tab=window]').click()`); await sleep(300); await shot(s2, '5-settings-window');
  await js(s2, `document.querySelector('[data-tab=security]').click()`); await sleep(300);

  // 3. PIN
  const sp1 = await js(s2, `window.innova.setPin('2468')`);
  check('ui:setPin', sp1.ok === true && sp1.config.pinSet === true, sp1);
  check('PIN на диске — только хеш', !fs.readFileSync(path.join(dir, 'config.json'), 'utf8').includes('2468'));
  s2.close(); await sleep(500);
  hotkey(m, 's');
  const s3 = await until(() => settingsWin(), 8000); await sleep(800);
  check('с PIN окно настроек открывается заблокированным', (await js(s3, `!document.getElementById('lock').classList.contains('hide') && document.getElementById('app').classList.contains('hide')`)) === true);
  check('заблокированное окно не отдаёт настройки и не даёт их менять', (await js(s3, `Promise.all([window.innova.state(), window.innova.save({zoom: 1.5}), window.innova.printers()]).then(([a, b, c]) => a.locked === true && !a.config && b.locked === true && c.locked === true)`)) === true);
  await shot(s3, '6-settings-locked');
  await js(s3, `document.getElementById('pin').value = '0000'; document.getElementById('unlock').click()`); await sleep(600);
  check('неверный PIN не открывает настройки', (await js(s3, `document.getElementById('lockMsg').textContent`)).includes('Неверный'));
  await js(s3, `document.getElementById('pin').value = '2468'; document.getElementById('unlock').click()`); await sleep(1200);
  check('верный PIN открывает настройки', (await js(s3, `document.getElementById('app').classList.contains('hide')`)) === false);

  // 4. «окно кассы» — сайт не может вызвать IPC настроек
  check('со страницы сайта IPC настроек недоступен (нет моста)', (await js(m, 'typeof window.innova')) === 'undefined');

  // 5. печать документа без диалога: скрытое окно + Electron print (несуществующий принтер → быстрая ошибка, без окон)
  const { printHtmlSilent } = require('../src/print-silent');
  const t0 = Date.now();
  const ps = await printHtmlSilent('<!doctype html><meta charset="utf-8"><body>Тест Чек №1</body>', { deviceName: 'NO-SUCH-PRINTER-' + Date.now() });
  check('печать документа на несуществующий принтер завершается ошибкой, а не зависанием', ps.ok === false && Date.now() - t0 < 20000, { ps, ms: Date.now() - t0 });
  check('скрытое окно печати закрыто', wins().every((w) => w.isVisible() || w === s3 || true) && !wins().some((w) => w.webContents.getURL().includes('innova365-doc-')));
  console.log('      ответ печати:', JSON.stringify(ps));

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed} / ${results.length}   (снимки: ${shots})`);
  server.close(); app.exit(failed ? 1 : 0);
}

app.whenReady().then(() => main().catch((e) => { console.error('FAIL  crashed:', e); app.exit(1); }));
setTimeout(() => { console.error('FAIL  тайм-аут теста (120 с)'); app.exit(1); }, 120_000).unref();
