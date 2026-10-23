'use strict';
/** Главный процесс на подставном electron: окна, IPC, PIN, навигация, права, агент, трей — без запуска настоящего Electron. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const Module = require('module');
const { makeElectron } = require('./fake-electron');

const ROOT = path.join(__dirname, '..');
const FRONT_FILE = (n) => require('url').pathToFileURL(path.join(ROOT, 'frontend', n)).toString();
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const origLoad = Module._load;
const booted = [];
test.after(async () => { for (const b of booted) await b.shutdown(); Module._load = origLoad; });

/** Запускает src/main.js с подставным electron и готовым config.json. */
async function boot(config = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-wire-'));
  const f = makeElectron({ userData: dir });
  const port = await freePort();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ ...config, agent: { port, token: 'a'.repeat(36), ...(config.agent || {}) } }));
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(ROOT, 'src')) || k.startsWith(path.join(ROOT, 'lib'))) delete require.cache[k];
  Module._load = function (req, ...rest) { return req === 'electron' ? f.electron : origLoad.call(this, req, ...rest); };
  require('../src/main');
  await tick(150);
  const BW = f.BrowserWindow;
  const find = (pred) => BW.all.filter((w) => !w.destroyed).find(pred);
  const b = {
    ...f, dir, port, BW,
    main: () => find((w) => w.opts.webPreferences?.partition === 'persist:innova365' && w.opts.title === 'Innova365'),
    office: () => find((w) => w.opts.title === 'Innova Office'),
    settings: () => find((w) => w.opts.webPreferences?.partition === 'innova-ui'),
    cfgFile: () => JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')),
    health: async (origin) => (await fetch(`http://127.0.0.1:${port}/health`, { headers: origin ? { Origin: origin } : {} })).json(),
    ui: (name, wc, ...args) => f.invoke('ui:' + name, { wc, args }),
    shutdown: async () => { f.app.quit(); await tick(40); },
  };
  booted.push(b);
  return b;
}

const SERVER = 'https://innova365.kz';
/** Открывает настройки так же, как пользователь: пунктом меню в трее. */
const openSettings = async (b) => { b.rec.menus.at(-1).find((i) => i.label === 'Настройки…').click(); await tick(); return b.settings(); };

test('первый запуск: открывается только мастер; после сохранения адреса — окно кассы', async () => {
  const b = await boot();
  assert.equal(b.main(), undefined);
  const s = b.settings();
  assert.ok(s, 'окно настроек'); assert.match(s.loaded[0], /settings\.html\?first=1/);
  const st = await b.ui('state', s.webContents);
  assert.equal(st.first, true); assert.equal(st.locked, false);
  assert.equal((await b.ui('save', s.webContents, { serverUrl: 'javascript:alert(1)' })).ok, false);
  assert.equal(b.main(), undefined);
  const r = await b.ui('save', s.webContents, { serverUrl: 'innova365.kz' });
  assert.equal(r.ok, true); assert.equal(r.config.serverUrl, SERVER);
  const m = b.main(); assert.ok(m, 'окно кассы создано'); assert.equal(m.loaded[0], SERVER);
  assert.equal(b.cfgFile().serverUrl, SERVER, 'настройка записана на диск');
});

test('окно кассы: безопасные webPreferences и режимы', async () => {
  const b = await boot({ serverUrl: SERVER, kiosk: true, zoom: 1.2 });
  const m = b.main(); const wp = m.opts.webPreferences;
  assert.equal(wp.contextIsolation, true); assert.equal(wp.sandbox, true); assert.equal(wp.nodeIntegration, false); assert.equal(wp.webSecurity, true);
  assert.equal(wp.allowRunningInsecureContent, false); assert.equal(wp.partition, 'persist:innova365'); assert.equal(wp.autoplayPolicy, 'no-user-gesture-required');
  assert.equal(wp.backgroundThrottling, false); assert.match(wp.preload, /preload\.js$/);
  assert.equal(m.opts.kiosk, true); assert.equal(m.loaded[0], SERVER);
  m.webContents.emit('did-finish-load'); assert.equal(m.webContents.zoom, 1.2);
  assert.equal(b.rec.switches.length, 0, 'для https особых флагов нет');
  const h = await boot({ serverUrl: 'http://192.168.1.10:8080' });
  assert.deepEqual(h.rec.switches[0], ['unsafely-treat-insecure-origin-as-secure', 'http://192.168.1.10:8080']);
});

test('навигация: чужие адреса — в браузер системы, редирект сервера доверяется, всплывающие окна фильтруются', async () => {
  const b = await boot({ serverUrl: SERVER });
  const wc = b.main().webContents;
  const nav = (url, isMainFrame = true) => { const e = { url, isMainFrame, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; return e; };
  let e = nav('https://evil.example/phish'); wc.emit('will-navigate', e);
  assert.ok(e.defaultPrevented); assert.deepEqual(b.rec.openExternal, ['https://evil.example/phish']);
  e = nav(SERVER + '/pedidos'); wc.emit('will-navigate', e); assert.ok(!e.defaultPrevented, 'свой адрес разрешён');
  e = nav('file:///c:/Windows/win.ini'); wc.emit('will-navigate', e); assert.ok(e.defaultPrevented, 'произвольный file:// запрещён');
  assert.equal(b.rec.openExternal.length, 1, 'file:// наружу не открывается');
  e = nav(FRONT_FILE('offline.html')); wc.emit('will-navigate', e); assert.ok(!e.defaultPrevented, 'свой экран «нет связи» разрешён');
  // редирект самого сервера на www-адрес: разрешён и источник становится доверенным
  e = nav('https://www.innova365.kz/'); wc.emit('will-redirect', e); assert.ok(!e.defaultPrevented);
  e = nav('https://www.innova365.kz/caja'); wc.emit('will-navigate', e); assert.ok(!e.defaultPrevented, 'после редиректа переходы внутри нового источника разрешены');
  assert.equal((await b.health('https://www.innova365.kz')).origin, true, 'агент теперь доверяет и новому источнику');
  e = nav('https://evil.example/', false); wc.emit('will-redirect', e); assert.ok(!e.defaultPrevented, 'не главный кадр не трогаем');
  // окна, открытые страницей
  const open = wc.openHandler;
  assert.equal(open({ url: 'about:blank' }).action, 'allow');
  assert.equal(open({ url: SERVER + '/print' }).action, 'allow');
  const ow = open({ url: 'about:blank' }).overrideBrowserWindowOptions.webPreferences; assert.equal(ow.sandbox, true); assert.equal(ow.nodeIntegration, false);
  assert.equal(open({ url: 'https://evil.example/x' }).action, 'deny'); assert.ok(b.rec.openExternal.includes('https://evil.example/x'));
  assert.equal(open({ url: 'javascript:alert(1)' }).action, 'deny'); assert.ok(!b.rec.openExternal.some((u) => u.startsWith('javascript')));
});

test('IPC: вызовы настроек только от файлов приложения', async () => {
  const b = await boot({ serverUrl: SERVER });
  const site = b.main().webContents;
  await assert.rejects(() => b.ui('state', site), /forbidden/);
  await assert.rejects(() => b.ui('save', site, { serverUrl: 'https://evil.example' }), /forbidden/);
  await assert.rejects(() => b.ui('quit', site), /forbidden/);
  assert.equal(b.cfgFile().serverUrl, SERVER); assert.equal(b.app.quitCalled, false);
  const wc = (await openSettings(b)).webContents;
  assert.ok((await b.ui('state', wc)).ok);
  await assert.rejects(() => b.invoke('ui:state', { wc, frame: { url: 'file:///c:/evil.html' } }), /forbidden/, 'вложенный кадр отклоняется');
  const evilFile = { ...wc.mainFrame, url: 'file:///c:/evil.html' };
  wc.mainFrame = evilFile;
  await assert.rejects(() => b.invoke('ui:state', { wc }), /forbidden/, 'file:// вне папки приложения отклоняется');
  wc.mainFrame = { url: FRONT_FILE('../evil.html') };
  await assert.rejects(() => b.invoke('ui:state', { wc }), /forbidden/, 'выход из папки через .. отклоняется');
});

test('PIN: без PIN свободно; с PIN — другое окно заблокировано; подбор ограничивается', async () => {
  const b = await boot({ serverUrl: SERVER });
  await openSettings(b);
  const A = b.settings().webContents;
  assert.equal((await b.ui('state', A)).locked, false);
  assert.equal((await b.ui('setPin', A, '12')).ok, false, 'короткий PIN отклонён');
  assert.equal((await b.ui('setPin', A, '4321')).ok, true);
  assert.equal((await b.ui('save', A, { zoom: 1.1 })).ok, true, 'окно, где PIN задан, остаётся открытым');
  assert.ok(!JSON.stringify(await b.ui('state', A)).includes('"hash"'), 'хеш PIN наружу не отдаётся');
  assert.ok(!('pin' in b.cfgFile()) || b.cfgFile().pin.hash, 'PIN на диске только в виде хеша');
  assert.ok(!fs.readFileSync(path.join(b.dir, 'config.json'), 'utf8').includes('4321'));
  // окно закрыли → новое окно заблокировано
  b.settings().close(); await tick();
  await openSettings(b);
  const B = b.settings().webContents;
  assert.notEqual(A.id, B.id);
  const st = await b.ui('state', B); assert.equal(st.locked, true); assert.ok(!('config' in st), 'в заблокированном состоянии настроек не видно');
  for (const call of [['save', { zoom: 1.3 }], ['printers'], ['testPrint', { printer: 'auto' }], ['newToken'], ['clearPin'], ['logs'], ['quit'], ['checkUrl', SERVER], ['restartAgent']]) {
    const r = await b.ui(call[0], B, ...call.slice(1)); assert.equal(r.locked, true, 'заблокировано: ' + call[0]);
  }
  assert.equal(b.cfgFile().zoom, 1.1, 'заблокированное окно ничего не изменило'); assert.ok(!b.app.quitCalled);
  // без разблокировки можно только открыть настройки / кассу / повторить подключение
  assert.equal((await b.ui('openApp', B)).ok, true);
  assert.equal((await b.ui('unlock', B, '0000')).ok, false);
  assert.equal((await b.ui('unlock', B, '4321')).ok, true);
  assert.equal((await b.ui('state', B)).locked, false); assert.equal((await b.ui('save', B, { zoom: 1.2 })).ok, true);
  assert.equal((await b.ui('clearPin', B)).ok, true); assert.equal((await b.ui('state', B)).hasPin, false);
});

test('PIN: 5 неверных попыток блокируют перебор, даже верный PIN в паузе не принимается', async () => {
  const b = await boot({ serverUrl: SERVER });
  await openSettings(b);
  const A = b.settings().webContents; await b.ui('setPin', A, '9999'); b.settings().close(); await tick();
  await openSettings(b);
  const B = b.settings().webContents;
  for (let i = 0; i < 5; i++) assert.equal((await b.ui('unlock', B, 'bad' + i)).ok, false);
  const r = await b.ui('unlock', B, '9999');
  assert.equal(r.ok, false); assert.ok(r.wait > 0); assert.match(r.error, /Слишком много попыток/);
  assert.equal((await b.ui('state', B)).locked, true);
});

test('сохранение настроек: whitelist полей, автозапуск, киоск, масштаб, перезапуск агента на новом порту', async () => {
  const b = await boot({ serverUrl: SERVER });
  await openSettings(b);
  const S = b.settings().webContents; const oldPort = b.port;
  assert.equal((await b.health()).agent, 'innova365');
  const evilToken = 'f'.repeat(36);
  const r1 = await b.ui('save', S, { window: { width: 5000 }, pin: { salt: 'aa', hash: 'bb' }, agent: { token: evilToken }, unknownField: 1, kiosk: true, autoStart: true, zoom: 1.4, closeToTray: true });
  assert.equal(r1.ok, true);
  const disk = b.cfgFile();
  assert.notEqual(disk.agent.token, evilToken, 'токен через save не меняется'); assert.ok(!('pin' in disk) || disk.pin === null, 'PIN через save не задаётся');
  assert.notEqual(disk.window.width, 5000); assert.ok(!('unknownField' in disk));
  assert.equal(b.main().kiosk, true); assert.equal(b.main().webContents.zoom, 1.4); assert.deepEqual(b.rec.loginItems.at(-1), { openAtLogin: true });
  assert.equal((await b.ui('save', S, { agent: { port: 80 } })).ok, false, 'неверный порт отклонён');
  const newPort = await freePort();
  const r2 = await b.ui('save', S, { agent: { port: newPort } });
  assert.equal(r2.ok, true); assert.equal(r2.agent.state, 'running'); assert.equal(r2.agent.port, newPort);
  assert.equal((await (await fetch(`http://127.0.0.1:${newPort}/health`)).json()).agent, 'innova365');
  await assert.rejects(() => fetch(`http://127.0.0.1:${oldPort}/health`), 'старый порт закрыт');
  const r3 = await b.ui('save', S, { agent: { enabled: false } });
  assert.equal(r3.agent.state, 'stopped'); await assert.rejects(() => fetch(`http://127.0.0.1:${newPort}/health`));
  // смена адреса кассы перезагружает окно и сбрасывает доверие к редиректам
  const m = b.main(); const before = m.loaded.length;
  await b.ui('save', S, { serverUrl: 'http://192.168.0.5:8080' });
  assert.equal(m.loaded.at(-1), 'http://192.168.0.5:8080'); assert.ok(m.loaded.length > before);
  // новый токен
  const old = b.cfgFile().agent.token; await b.ui('newToken', S); assert.notEqual(b.cfgFile().agent.token, old);
});

test('агент в составе приложения: источник кассы разрешён автоматически, токен — для остальных', async () => {
  const b = await boot({ serverUrl: SERVER, officeUrl: 'https://office.innova365.kz', agent: { extraOrigins: ['https://pos2.kz'] } });
  for (const [o, want] of [[SERVER, true], ['https://office.innova365.kz', true], ['https://pos2.kz', true], ['https://evil.example', false], [null, false]]) assert.equal((await b.health(o)).origin, want, String(o));
  const r = await fetch(`http://127.0.0.1:${b.port}/printers`); assert.equal(r.status, 401);
  assert.equal((await fetch(`http://127.0.0.1:${b.port}/printers`, { headers: { 'X-Token': 'a'.repeat(36) } })).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${b.port}/printers`, { headers: { Origin: SERVER } })).status, 200);
});

test('права сайта и WebUSB', async () => {
  const b = await boot({ serverUrl: SERVER, officeUrl: 'https://office.innova365.kz' });
  const ses = b.sessions.get('persist:innova365');
  const ask = (perm, url) => new Promise((res) => ses.permReq({}, perm, res, { requestingUrl: url }));
  assert.equal(await ask('notifications', SERVER + '/'), true); assert.equal(await ask('fullscreen', SERVER + '/'), true);
  assert.equal(await ask('media', SERVER + '/'), false, 'камера/микрофон запрещены'); assert.equal(await ask('geolocation', SERVER + '/'), false); assert.equal(await ask('hid', SERVER + '/'), false);
  assert.equal(await ask('notifications', 'https://evil.example/'), false, 'чужому сайту нельзя ничего');
  assert.equal(await ask('notifications', 'https://office.innova365.kz/x'), true, 'Office — свой');
  assert.equal(ses.permCheck({}, 'notifications', SERVER), true); assert.equal(ses.permCheck({}, 'media', SERVER), false);
  assert.equal(ses.devPerm({ deviceType: 'usb', origin: SERVER }), true); assert.equal(ses.devPerm({ deviceType: 'usb', origin: 'https://evil.example' }), false); assert.equal(ses.devPerm({ deviceType: 'hid', origin: SERVER }), false);
  const ui = b.sessions.get('innova-ui'); assert.equal(await new Promise((res) => ui.permReq({}, 'notifications', res, {})), false);
  // выбор USB-устройства: один принтер — сразу; несколько — диалог; нет — отмена
  const pick = (devices) => new Promise((res) => { const ev = { prevented: false, preventDefault() { this.prevented = true; } }; ses.emit('select-usb-device', ev, { deviceList: devices }, res); assert.ok(ev.prevented); });
  assert.equal(await pick([{ deviceClass: 3, deviceId: 'kbd' }, { deviceClass: 7, deviceId: 'prn' }]), 'prn', 'предпочитает класс «принтер»');
  assert.equal(await pick([]), undefined);
  b.electron.dialog.answer = 1;
  assert.equal(await pick([{ deviceClass: 7, deviceId: 'p1', productName: 'A', vendorId: 1, productId: 2 }, { deviceClass: 7, deviceId: 'p2', productName: 'B', vendorId: 1, productId: 3 }]), 'p2');
  assert.deepEqual(b.rec.messageBoxes.at(-1).buttons, ['A', 'B', 'Отмена']);
  b.electron.dialog.answer = 2;
  assert.equal(await pick([{ deviceClass: 7, deviceId: 'p1', productName: 'A', vendorId: 1, productId: 2 }, { deviceClass: 7, deviceId: 'p2', productName: 'B', vendorId: 1, productId: 3 }]), undefined, 'отмена');
});

test('закрытие окна: киоск + PIN → настройки; в трей; обычное', async () => {
  const a = await boot({ serverUrl: SERVER, closeToTray: true });
  const e1 = a.main().close(); assert.ok(e1.prevented); assert.equal(a.main().visible, false, 'свернуто в трей'); assert.equal(a.main().destroyed, false);
  const k = await boot({ serverUrl: SERVER, kiosk: true });
  await openSettings(k); await k.ui('setPin', k.settings().webContents, '2468'); k.settings().close(); await tick();
  const e2 = k.main().close(); assert.ok(e2.prevented, 'киоск с PIN не закрывается'); await tick();
  assert.match(k.settings().loaded.at(-1), /tab=about&hint=quit/);
  const n = await boot({ serverUrl: SERVER });
  const e3 = n.main().close(); assert.ok(!e3.prevented);
});

test('экран «нет связи»: ошибка загрузки показывает offline.html; повтор открывает сайт только при доступности', async () => {
  const b = await boot({ serverUrl: SERVER });
  const m = b.main(); const wc = m.webContents;
  wc.emit('did-fail-load', {}, -106, 'ERR_INTERNET_DISCONNECTED', SERVER + '/', true);
  assert.match(wc.url, /offline\.html\?url=https%3A%2F%2Finnova365\.kz&code=-106&desc=ERR_INTERNET_DISCONNECTED/);
  const loads = m.loaded.length;
  wc.emit('did-fail-load', {}, -3, 'ERR_ABORTED', SERVER + '/', true); wc.emit('did-fail-load', {}, -105, 'x', SERVER + '/x', false);
  assert.equal(m.loaded.length, loads, 'отмена перехода и ошибки вложенных кадров игнорируются');
  b.electron.net.fake = async () => { throw new Error('net::ERR_CONNECTION_TIMED_OUT'); };
  let r = await b.invoke('ui:retry', { wc, args: [] }); assert.equal(r.ok, false); assert.match(r.error, /ERR_CONNECTION_TIMED_OUT/); assert.match(wc.url, /offline\.html/);
  b.electron.net.fake = async (u) => ({ ok: true, status: 200, url: u });
  r = await b.invoke('ui:retry', { wc, args: [] }); assert.equal(r.ok, true); assert.equal(wc.url, SERVER);
  wc.emit('did-fail-load', {}, -106, 'ERR_X', SERVER + '/', true);
  b.electron.net.fake = async () => ({ ok: false, status: 502 });
  r = await b.invoke('ui:retry', { wc, args: [] }); assert.equal(r.ok, false);
  // падение процесса страницы → перезагрузка
  const before = wc.reloads; wc.emit('render-process-gone', {}, { reason: 'crashed' }); await tick(1700); assert.equal(wc.reloads, before + 1);
});

test('Office: окно только при заданном адресе, своя защита навигации', async () => {
  const b = await boot({ serverUrl: SERVER, officeUrl: 'https://office.innova365.kz' });
  const tray = b.rec.menus.at(-1); const item = (l) => tray.find((i) => i.label === l);
  assert.equal(item('Открыть Office').enabled, true);
  item('Открыть Office').click(); await tick();
  const o = b.office(); assert.ok(o); assert.equal(o.loaded[0], 'https://office.innova365.kz');
  const ev = { url: SERVER + '/x', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  o.webContents.emit('will-navigate', ev); assert.ok(ev.defaultPrevented, 'из окна Office нельзя уйти на кассу или чужой адрес');
  const ev2 = { url: 'https://office.innova365.kz/inventory', preventDefault() { throw new Error('не должно'); } }; o.webContents.emit('will-navigate', ev2);
  // без адреса Office — пункт недоступен
  const c = await boot({ serverUrl: SERVER });
  assert.equal(c.rec.menus.at(-1).find((i) => i.label === 'Открыть Office').enabled, false);
});

test('трей: «Выход» — сразу без PIN, через настройки с PIN; статус агента', async () => {
  const b = await boot({ serverUrl: SERVER });
  assert.match(b.rec.menus.at(-1).find((i) => /^Агент печати/.test(i.label)).label, /работает \(порт \d+\)/);
  await openSettings(b); await b.ui('setPin', b.settings().webContents, '1357'); b.settings().close(); await tick();
  b.rec.menus.at(-1).find((i) => i.label === 'Выход').click(); await tick();
  assert.equal(b.app.quitCalled, false, 'с PIN выход не мгновенный'); assert.match(b.settings().loaded.at(-1), /hint=quit/);
  const n = await boot({ serverUrl: SERVER });
  n.rec.menus.at(-1).find((i) => i.label === 'Выход').click(); assert.equal(n.app.quitCalled, true);
  await tick(60); await assert.rejects(() => fetch(`http://127.0.0.1:${n.port}/health`), 'при выходе агент остановлен');
});

test('печать документов без диалога: только по включённой настройке и только от доверенной страницы', async () => {
  const b = await boot({ serverUrl: SERVER });
  const wc = b.main().webContents; wc.url = SERVER + '/caja';
  const evil = { id: 999, getURL: () => 'https://evil.example/', mainFrame: {} };
  assert.deepEqual(await b.invoke('web:info', { wc }), { version: '1.0.0-test' }); assert.deepEqual(await b.invoke('web:info', { wc: evil }), {});
  assert.deepEqual(await b.invoke('web:printHtml', { wc, args: ['<html>x</html>', {}] }), { handled: false }, 'по умолчанию выключено');
  await openSettings(b);
  await b.ui('save', b.settings().webContents, { print: { silent: true, deviceName: 'XP-80C' } });
  assert.deepEqual(await b.invoke('web:printHtml', { wc: evil, args: ['<html>x</html>', {}] }), { handled: false }, 'чужая страница печатать не может');
  assert.equal(b.rec.printed.length, 0);
  assert.deepEqual(await b.invoke('web:printHtml', { wc, args: ['', {}] }), { handled: false }); assert.deepEqual(await b.invoke('web:printHtml', { wc, args: [{ evil: 1 }, {}] }), { handled: false });
  const r = await b.invoke('web:printHtml', { wc, args: ['<!doctype html><html><body>Чек №1</body></html>', { title: 'Чек' }] });
  assert.deepEqual(r, { handled: true });
  assert.equal(b.rec.printed.length, 1); assert.equal(b.rec.printed[0].opts.silent, true); assert.equal(b.rec.printed[0].opts.deviceName, 'XP-80C');
  const doc = b.BW.all.find((w) => w.opts.webPreferences?.javascript === false); assert.ok(doc, 'документ печатается в окне без JavaScript'); assert.equal(doc.opts.show, false);
  assert.ok(doc.destroyed, 'скрытое окно уничтожено'); assert.match(doc.loaded[0], /innova365-doc-.*\.html$/);
});

test('пробная печать и проверка адреса через IPC', async () => {
  const b = await boot({ serverUrl: SERVER });
  await openSettings(b); const S = b.settings().webContents;
  // реальный TCP-«принтер» на loopback
  const got = []; const srv = net.createServer((s) => s.on('data', (d) => got.push(d))).listen(0, '127.0.0.1'); await new Promise((r) => srv.on('listening', r));
  const port = srv.address().port;
  const ok = await b.ui('testPrint', S, { printer: `127.0.0.1:${port}`, width: 58, codepage: 'cp1251' });
  assert.equal(ok.ok, true); await tick(250);
  const data = Buffer.concat(got); assert.deepEqual([...data.subarray(0, 5)], [0x1b, 0x40, 0x1b, 0x74, 46], 'ESC @, кодовая страница 46 (cp1251)');
  assert.deepEqual([...data.subarray(-4)], [0x1d, 0x56, 0x42, 0x00]);
  const bad = await b.ui('testPrint', S, { printer: '8.8.8.8:9100' }); assert.equal(bad.ok, false); assert.match(bad.error, /локальной сети/);
  const closed = await b.ui('testPrint', S, { printer: '127.0.0.1:9' }); assert.equal(closed.ok, false);
  await new Promise((r) => srv.close(r));
  // проверка адреса
  b.electron.net.fake = async (u) => ({ ok: true, status: 200, url: u });
  const c1 = await b.ui('checkUrl', S, 'innova365.kz'); assert.equal(c1.ok, true); assert.equal(c1.url, SERVER);
  assert.equal((await b.ui('checkUrl', S, 'ftp://x')).ok, false);
  assert.equal((await b.ui('testAgent', S)).ok, true);
  const logs = await b.ui('logs', S); assert.ok(logs.lines.some((l) => /\[agent\] запущен/.test(l)));
});

test('второй экземпляр и перезапуск настроек не ломают приложение', async () => {
  const b = await boot({ serverUrl: SERVER });
  b.main().hide(); b.app.emit('second-instance'); assert.equal(b.main().visible, true, 'второй запуск показывает окно');
  await openSettings(b);
  const n = b.BW.all.length; await openSettings(b); assert.equal(b.BW.all.length, n, 'окно настроек одно');
});
