'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = require('../lib/url');
const pin = require('../lib/pin');
const { Config, sanitize, DEFAULTS } = require('../lib/config');
const escpos = require('../lib/escpos');
const { classify, pickBest, looksLikeReceipt } = require('../lib/printers');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'innova-test-'));

/* ───────── url ───────── */
test('normalizeServerUrl: схемы и мусор', () => {
  assert.equal(url.normalizeServerUrl('innova365.kz'), 'https://innova365.kz');
  assert.equal(url.normalizeServerUrl('  https://innova365.kz/  '), 'https://innova365.kz');
  assert.equal(url.normalizeServerUrl('194.32.142.75:8080'), 'http://194.32.142.75:8080');
  assert.equal(url.normalizeServerUrl('localhost:8080'), 'http://localhost:8080');
  assert.equal(url.normalizeServerUrl('https://x.kz/app/?a=1#h'), 'https://x.kz/app');
  for (const bad of ['', '   ', 'javascript:alert(1)', 'file:///c:/x', 'ftp://x.kz', 'https://user:pw@x.kz', 'http://', 'a'.repeat(400)]) assert.equal(url.normalizeServerUrl(bad), null, bad);
});
test('isAllowedOrigin / isPrivateIPv4 / isRelayHost', () => {
  assert.ok(url.isAllowedOrigin('http://localhost:5173', []));
  assert.ok(url.isAllowedOrigin('http://127.0.0.1', []));
  assert.ok(!url.isAllowedOrigin('https://evil.com', []));
  assert.ok(!url.isAllowedOrigin(undefined, ['https://a.kz']));
  assert.ok(url.isAllowedOrigin('https://innova365.kz', ['https://innova365.kz']));
  assert.ok(!url.isAllowedOrigin('http://localhost.evil.com', []));
  for (const ok of ['10.0.0.5', '172.16.1.1', '172.31.255.1', '192.168.1.50', '127.0.0.1']) assert.ok(url.isPrivateIPv4(ok), ok);
  for (const bad of ['8.8.8.8', '172.32.0.1', '192.169.1.1', '300.1.1.1', 'example.com', '10.0.0']) assert.ok(!url.isPrivateIPv4(bad), bad);
  assert.ok(url.sameOrigin('https://a.kz/x', 'https://a.kz/y'));
  assert.ok(!url.sameOrigin('https://a.kz', 'http://a.kz'));
});

/* ───────── pin ───────── */
test('pin: хеш, проверка, ограничитель', () => {
  const rec = pin.hashPin('1234');
  assert.ok(pin.verifyPin('1234', rec));
  assert.ok(!pin.verifyPin('1235', rec));
  assert.ok(!pin.verifyPin('', rec));
  assert.ok(!pin.verifyPin('1234', null));
  assert.notEqual(pin.hashPin('1234').hash, rec.hash, 'соль разная');
  assert.throws(() => pin.hashPin('12'));
  assert.throws(() => pin.hashPin('пароль1'));
  let t = 1000; const lim = new pin.PinLimiter({ now: () => t });
  for (let i = 0; i < 4; i++) lim.fail();
  assert.equal(lim.wait(), 0);
  lim.fail();
  assert.equal(lim.wait(), 30000);
  t += 31000; assert.equal(lim.wait(), 0);
  lim.fail(); lim.ok(); for (let i = 0; i < 4; i++) lim.fail(); assert.equal(lim.wait(), 0);
});

/* ───────── config ───────── */
test('config: значения по умолчанию, токен создаётся и сохраняется', () => {
  const f = path.join(tmp(), 'config.json');
  const c = new Config(f);
  assert.equal(c.get().serverUrl, '');
  assert.match(c.get().agent.token, /^[0-9a-f]{36}$/);
  const t = c.get().agent.token;
  assert.equal(new Config(f).get().agent.token, t, 'токен не меняется между запусками');
});
test('config: update валидирует и не сохраняет при ошибке', () => {
  const f = path.join(tmp(), 'config.json'); const c = new Config(f);
  assert.ok(c.update({ serverUrl: 'innova365.kz', agent: { port: 9200 }, kiosk: true }).ok);
  assert.equal(c.get().serverUrl, ''); assert.equal(c.get().agent.port, 9200); assert.equal(c.get().kiosk, true);
  const r = c.update({ serverUrl: 'javascript:alert(1)', kiosk: false });
  assert.ok(!r.ok); assert.equal(c.get().kiosk, true, 'ничего не применилось');
  assert.ok(!c.update({ agent: { port: 80 } }).ok);
  assert.ok(!c.update({ agent: { port: 'abc' } }).ok);
  assert.equal(c.get().serverUrl, '');
});
test('config: произвольные поля и тип данных', () => {
  const { value } = sanitize({ kiosk: 'yes', zoom: 9, fullscreen: 1, evil: { a: 1 }, agent: { token: 'not hex!' }, print: { deviceName: 'x'.repeat(500) } });
  assert.equal(value.kiosk, false); assert.equal(value.zoom, 2); assert.equal(value.fullscreen, false);
  assert.ok(!('evil' in value)); assert.equal(value.agent.token, ''); assert.equal(value.print.deviceName.length, 200);
  assert.equal(sanitize({ zoom: 'abc' }).value.zoom, 1);
});
test('config: extraOrigins из строки приводятся к источникам', () => {
  const { value } = sanitize({ agent: { extraOrigins: 'https://a.kz/path, http://10.0.0.5:8080;  junk javascript:x' } });
  assert.deepEqual(value.agent.extraOrigins, ['https://a.kz', 'http://10.0.0.5:8080']);
});
test('config: PIN только через setPin, наружу хеш не отдаётся, update его не затирает', () => {
  const f = path.join(tmp(), 'config.json'); const c = new Config(f);
  assert.ok(c.checkPin('anything'), 'без PIN проверка проходит');
  c.setPin('4321');
  assert.ok(c.hasPin()); assert.ok(c.checkPin('4321')); assert.ok(!c.checkPin('0000'));
  assert.equal(c.view().pinSet, true); assert.ok(!('pin' in c.view()));
  c.update({ pin: null, kiosk: true }); assert.ok(c.hasPin(), 'update не снимает PIN');
  c.update({ pin: { salt: 'aa', hash: 'bb' } }); assert.ok(c.checkPin('4321'), 'update не подменяет PIN');
  assert.ok(new Config(f).checkPin('4321'), 'PIN переживает перезапуск');
  c.clearPin(); assert.ok(!c.hasPin());
});
test('config: повреждённый файл → .bak и настройки по умолчанию', () => {
  const d = tmp(); const f = path.join(d, 'config.json');
  fs.writeFileSync(f, '{ broken json');
  const c = new Config(f);
  assert.equal(c.get().serverUrl, ''); assert.ok(fs.existsSync(f + '.bak'));
  assert.deepEqual(Object.keys(c.get()).sort(), Object.keys(DEFAULTS).sort());
});
test('config: запись атомарна (нет .tmp после сохранения), файл читаем', () => {
  const d = tmp(); const f = path.join(d, 'config.json'); const c = new Config(f);
  c.update({ serverUrl: 'https://x.kz' });
  assert.ok(!fs.existsSync(f + '.tmp')); assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).serverUrl, '');
});
test('config: окно — частичное обновление не сбрасывает координаты', () => {
  const c = new Config(path.join(tmp(), 'c.json'));
  c.update({ window: { width: 1000, height: 700, x: 50, y: 60, maximized: false } });
  c.update({ window: { width: 1100 } });
  assert.equal(c.get().window.x, 50); assert.equal(c.get().window.width, 1100);
});

/* ───────── escpos ───────── */
test('escpos: кодировки кириллицы', () => {
  assert.deepEqual([...escpos.encode('Аб', 'cp866')], [0x80, 0xa1]);
  assert.deepEqual([...escpos.encode('Яя', 'cp866')], [0x9f, 0xef]);
  assert.deepEqual([...escpos.encode('Ёё', 'cp866')], [0xf0, 0xf1]);
  assert.deepEqual([...escpos.encode('Аб', 'cp1251')], [0xc0, 0xe1]);
  assert.deepEqual([...escpos.encode('Яя', 'cp1251')], [0xdf, 0xff]);
  assert.deepEqual([...escpos.encode('Ёё', 'cp1251')], [0xa8, 0xb8]);
  assert.deepEqual([...escpos.encode('Ab1 ', 'ascii')], [0x41, 0x62, 0x31, 0x20]);
  assert.deepEqual([...escpos.encode('Ж', 'ascii')], [0x3f]);
  assert.deepEqual([...escpos.encode('ә', 'cp866')], [0x3f], 'казахские буквы не ломают поток');
  // все буквы русского алфавита дают уникальные байты ≥ 0x80
  for (const cp of ['cp866', 'cp1251']) {
    const alpha = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';
    const b = [...escpos.encode(alpha, cp)];
    assert.equal(new Set(b).size, alpha.length, cp); assert.ok(b.every((x) => x >= 0x80), cp);
  }
});
test('escpos: пробный чек — команды и ширина', () => {
  const b = escpos.testReceipt({ printer: 'POS-80', width: 80, codepage: 'cp866', now: new Date('2026-01-01T10:00:00Z') });
  assert.deepEqual([...b.subarray(0, 7)], [0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, 17], 'сброс + выход из китайского режима + CP866');
  assert.ok(b.includes(escpos.encode('Пробная печать', 'cp866')), 'пробный чек содержит кириллицу CP866');
  assert.deepEqual([...b.subarray(-4)], [0x1d, 0x56, 0x42, 0x00], 'отрезка в конце');
  assert.ok(b.includes(Buffer.from('POS-80')));
  const b58 = escpos.testReceipt({ width: 58, codepage: 'cp1251', cut: false });
  assert.equal(b58[6], 46); assert.notDeepEqual([...b58.subarray(-4)], [0x1d, 0x56, 0x42, 0x00]);
  assert.ok(b58.includes(Buffer.from('-'.repeat(32))) && !b58.includes(Buffer.from('-'.repeat(33))));
  assert.ok(b.includes(Buffer.from('-'.repeat(48))));
  assert.deepEqual(escpos.wrap('слово '.repeat(10).trim(), 12).every((l) => l.length <= 12), true);
});

/* ───────── printers ───────── */
test('printers: оценка и выбор', () => {
  const list = [
    { name: 'Microsoft Print to PDF', port: 'PORTPROMPT:', isDefault: true },
    { name: 'XP-80C', port: 'USB001', isDefault: false },
    { name: 'HP LaserJet', port: 'IP_192.168.1.5', isDefault: false },
    { name: 'POS-58 (offline)', port: 'USB002', offline: true },
  ].map(classify);
  assert.equal(pickBest(list).name, 'XP-80C');
  assert.ok(list[1].usb && list[1].thermal);
  assert.ok(list[0].score < 0);
  assert.equal(pickBest([classify({ name: 'Microsoft Print to PDF', port: 'x', isDefault: true })]), null);
  assert.equal(pickBest([classify({ name: 'HP LaserJet MFP M129', port: 'USB002', isDefault: true })]), null);
  assert.equal(pickBest([]), null);
  assert.ok(looksLikeReceipt(classify({ name: 'XP-80C', port: 'USB001' })));
  assert.ok(looksLikeReceipt(classify({ name: 'Generic / Text Only', port: 'USB001' })));
  assert.ok(!looksLikeReceipt(classify({ name: 'HP LaserJet MFP M129', port: 'USB002' })), 'лазерный принтер не считается кассовым');
  assert.ok(!looksLikeReceipt(null));
});

test('config: activation binds fixed URL and keeps token out of UI', () => {
  const f = path.join(tmp(), 'config.json'); const c = new Config(f);
  c.activate('a'.repeat(64), { id: 'aisultan', name: 'Aisultan' });
  assert.equal(c.get().serverUrl, 'https://innova365.kz');
  assert.equal(c.view().activation.token, undefined);
  c.update({ serverUrl: 'https://evil.example' });
  assert.equal(c.get().serverUrl, 'https://innova365.kz');
  assert.equal(new Config(f).get().activation.restaurantId, 'aisultan');
});
