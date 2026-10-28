'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const path = require('path');

const { createAgent } = require('../lib/agent');
const { RawPrinter } = require('../lib/rawprint');
const { classifyAll } = require('../lib/printers');

/** Подставной принтер ОС: запоминает, что на него «напечатали». */
function fakePrinter(list = []) {
  const jobs = [];
  return {
    jobs, relayed: [],
    async list() { return classifyAll(list); },
    async print(name, data) { if (name === 'BROKEN') throw new Error('OpenPrinter: BROKEN'); jobs.push({ name, data }); },
    async relay(host, port, data) { this.relayed.push({ host, port, data }); if (host === '10.9.9.9') throw new Error('printer 10.9.9.9:9100 not reachable'); },
    async discover(subnet) { return [`${subnet}.50`]; },
  };
}

const PRINTERS = [{ name: 'Microsoft Print to PDF', port: 'PORTPROMPT:', isDefault: true }, { name: 'XP-80C', port: 'USB001' }, { name: 'Мой принтер', port: 'USB002' }, { name: 'BROKEN', port: 'USB003' }];
let settings;

/** Поднимает сервер на свободном порту и возвращает его вместе с номером порта. */
const listen = (srv, host = '127.0.0.1') => new Promise((resolve) => srv.listen(0, host, () => resolve({ srv, port: srv.address().port })));

async function boot(opts = {}) {
  settings = { port: 0, lan: false, token: 'a'.repeat(36), origins: ['https://innova365.kz'], ...opts };
  const printer = fakePrinter(PRINTERS);
  const logs = [];
  // порт 0 нельзя указать через getSettings → берём свободный заранее
  const { srv, port } = await listen(net.createServer()); await new Promise((r) => srv.close(r));
  settings.port = port;
  const agent = createAgent({ getSettings: () => settings, printer, log: (m) => logs.push(m), version: '9.9.9' });
  await agent.start();
  return { agent, printer, port, logs };
}

const call = (port, method, p, { headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
    const chunks = []; res.on('data', (c) => chunks.push(c));
    res.on('end', () => { const t = Buffer.concat(chunks).toString(); let j = null; try { j = JSON.parse(t); } catch { /* пусто */ } resolve({ status: res.statusCode, headers: res.headers, json: j, text: t }); });
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const ORIGIN = { Origin: 'https://innova365.kz' };
const TOKEN = () => ({ 'X-Token': settings.token });

test('agent: health без токена; origin разрешён → CORS и PNA', async () => {
  const { agent, port } = await boot();
  const a = await call(port, 'GET', '/health', { headers: ORIGIN });
  assert.equal(a.status, 200); assert.equal(a.json.agent, 'innova365'); assert.equal(a.json.origin, true); assert.equal(a.json.version, '9.9.9-desktop');
  assert.equal(a.headers['access-control-allow-origin'], 'https://innova365.kz');
  assert.equal(a.headers['access-control-allow-private-network'], 'true');
  const b = await call(port, 'GET', '/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(b.status, 200); assert.equal(b.json.origin, false); assert.equal(b.headers['access-control-allow-origin'], undefined, 'чужому сайту CORS не даём');
  const c = await call(port, 'GET', '/health');
  assert.equal(c.json.origin, false);
  await agent.stop();
});

test('agent: preflight OPTIONS', async () => {
  const { agent, port } = await boot();
  const r = await call(port, 'OPTIONS', '/print?printer=auto', { headers: { ...ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(r.status, 204); assert.match(r.headers['access-control-allow-methods'], /POST/); assert.equal(r.headers['access-control-allow-private-network'], 'true');
  const evil = await call(port, 'OPTIONS', '/print', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.status, 204); assert.equal(evil.headers['access-control-allow-origin'], undefined);
  await agent.stop();
});

test('agent: доступ — по источнику или по токену, иначе 401', async () => {
  const { agent, port } = await boot();
  assert.equal((await call(port, 'GET', '/printers')).status, 401);
  assert.equal((await call(port, 'GET', '/printers', { headers: { Origin: 'https://evil.example' } })).status, 401);
  assert.equal((await call(port, 'GET', '/printers', { headers: { 'X-Token': 'wrong' } })).status, 401);
  assert.equal((await call(port, 'GET', '/printers', { headers: { 'X-Token': '' } })).status, 401);
  const byOrigin = await call(port, 'GET', '/printers', { headers: ORIGIN });
  assert.equal(byOrigin.status, 200); assert.equal(byOrigin.json.length, 4);
  assert.equal((await call(port, 'GET', '/printers', { headers: TOKEN() })).status, 200);
  assert.equal((await call(port, 'POST', '/print?printer=auto', { body: Buffer.from('x') })).status, 401);
  await agent.stop();
});

test('agent: /best и печать auto выбирают кассовый принтер, не PDF', async () => {
  const { agent, port, printer } = await boot();
  const best = await call(port, 'GET', '/best', { headers: ORIGIN });
  assert.equal(best.json.name, 'XP-80C');
  const bytes = Buffer.from([0x1b, 0x40, 0xd0, 0x80, 0x0a]);
  const r = await call(port, 'POST', '/print?printer=auto', { headers: { ...ORIGIN, 'Content-Type': 'application/octet-stream' }, body: bytes });
  assert.equal(r.status, 200); assert.equal(r.json.printer, 'XP-80C');
  assert.deepEqual([...printer.jobs[0].data], [...bytes], 'байты дошли без искажений');
  const named = await call(port, 'POST', '/print?printer=' + encodeURIComponent('Мой принтер'), { headers: ORIGIN, body: bytes });
  assert.equal(named.json.printer, 'Мой принтер');
  assert.equal((await call(port, 'POST', '/print', { headers: ORIGIN, body: bytes })).json.printer, 'XP-80C', 'без параметра = auto');
  await agent.stop();
});

test('agent: ошибки печати и валидация', async () => {
  const { agent, port } = await boot();
  const bytes = Buffer.from('x');
  const e1 = await call(port, 'POST', '/print?printer=BROKEN', { headers: ORIGIN, body: bytes });
  assert.equal(e1.status, 502); assert.match(e1.json.error, /BROKEN/); assert.equal(e1.json.attempts.length, 2, 'вторая попытка через спулер');
  assert.equal((await call(port, 'POST', '/print?printer=auto', { headers: ORIGIN })).status, 400, 'пустое тело');
  assert.equal((await call(port, 'POST', '/print?printer=' + encodeURIComponent('a\u0001b'), { headers: ORIGIN, body: bytes })).status, 400);
  assert.equal((await call(port, 'POST', '/print?printer=' + 'x'.repeat(300), { headers: ORIGIN, body: bytes })).status, 400);
  assert.equal((await call(port, 'GET', '/nope', { headers: ORIGIN })).status, 404);
  const big = await call(port, 'POST', '/print?printer=auto', { headers: ORIGIN, body: Buffer.alloc(2 * 1024 * 1024 + 10) }).catch((e) => ({ status: 'reset:' + e.code }));
  assert.ok(big.status === 413 || String(big.status).startsWith('reset'), 'слишком большое тело отклоняется: ' + big.status);
  await agent.stop();
});

test('agent: ретрансляция на сетевой принтер — только частные адреса', async () => {
  const { agent, port, printer } = await boot();
  const bytes = Buffer.from('relay');
  const ok = await call(port, 'POST', '/print?host=192.168.1.50&port=9100', { headers: ORIGIN, body: bytes });
  assert.equal(ok.status, 200); assert.equal(ok.json.printer, '192.168.1.50:9100'); assert.equal(printer.relayed[0].port, 9100);
  const noport = await call(port, 'POST', '/print?host=10.0.0.7', { headers: ORIGIN, body: bytes });
  assert.equal(noport.json.printer, '10.0.0.7:9100');
  for (const h of ['8.8.8.8', 'example.com', '169.254.169.254', '172.32.0.1']) assert.equal((await call(port, 'POST', '/print?host=' + h, { headers: ORIGIN, body: bytes })).status, 400, h);
  assert.equal((await call(port, 'POST', '/print?host=10.0.0.7&port=70000', { headers: ORIGIN, body: bytes })).status, 400);
  assert.equal((await call(port, 'POST', '/print?host=10.9.9.9', { headers: ORIGIN, body: bytes })).status, 500, 'недоступный принтер → 500 с текстом');
  await agent.stop();
});

test('agent: /discover — только частные подсети', async () => {
  const { agent, port } = await boot();
  const ok = await call(port, 'GET', '/discover?subnet=192.168.1', { headers: ORIGIN });
  assert.deepEqual(ok.json, { subnet: '192.168.1', printers: ['192.168.1.50'] });
  assert.equal((await call(port, 'GET', '/discover?subnet=8.8.8', { headers: ORIGIN })).status, 400);
  assert.equal((await call(port, 'GET', '/discover?subnet=192.168.1.1;rm', { headers: ORIGIN })).status, 400);
  await agent.stop();
});

test('agent: защита от DNS-rebinding (Host) на loopback', async () => {
  const { agent, port } = await boot();
  const r = await call(port, 'GET', '/health', { headers: { Host: 'evil.example.com' } });
  assert.equal(r.status, 400);
  const ok = await call(port, 'GET', '/health', { headers: { Host: `localhost:${port}` } });
  assert.equal(ok.status, 200);
  await agent.stop();
});

test('agent: порт занят → состояние busy, не падает; перезапуск и остановка', async () => {
  const { srv: blocker, port } = await listen(net.createServer());
  const agent = createAgent({ getSettings: () => ({ port, lan: false, token: 't'.repeat(36), origins: [] }), printer: fakePrinter() });
  const st = await agent.start();
  assert.equal(st.state, 'busy'); assert.match(st.error, /занят/);
  await new Promise((r) => blocker.close(r));
  const st2 = await agent.restart();
  assert.equal(st2.state, 'running'); assert.equal((await call(port, 'GET', '/health')).status, 200);
  await agent.stop();
  assert.equal(agent.status().state, 'stopped');
  await assert.rejects(() => call(port, 'GET', '/health'));
});

test('agent: настройки читаются на каждый запрос (смена источников без перезапуска)', async () => {
  const { agent, port } = await boot({ origins: [] });
  assert.equal((await call(port, 'GET', '/printers', { headers: ORIGIN })).status, 401);
  settings.origins = ['https://innova365.kz'];
  assert.equal((await call(port, 'GET', '/printers', { headers: ORIGIN })).status, 200);
  settings.token = 'b'.repeat(36);
  assert.equal((await call(port, 'GET', '/printers', { headers: { 'X-Token': 'a'.repeat(36) } })).status, 401);
  assert.equal((await call(port, 'GET', '/printers', { headers: { 'X-Token': 'b'.repeat(36) } })).status, 200);
  await agent.stop();
});

/* ───────── RawPrinter: сеть и очереди без реального принтера ───────── */
test('rawprint.relay: данные доходят до TCP-сервера; недоступный адрес → понятная ошибка', async () => {
  const got = []; const { srv, port: srvPort } = await listen(net.createServer((s) => s.on('data', (d) => got.push(d))));
  const rp = new RawPrinter({ psDir: '.', platform: 'linux' });
  await rp.relay('127.0.0.1', srvPort, Buffer.from([1, 2, 3, 4]), { settleMs: 30 });
  assert.deepEqual([...Buffer.concat(got)], [1, 2, 3, 4]);
  await new Promise((r) => srv.close(r));
  await assert.rejects(() => rp.relay('127.0.0.1', srvPort, Buffer.from('x'), { connectMs: 500 }), /127\.0\.0\.1:\d+/, 'порт закрыт → ошибка');
});

test('rawprint.discover: находит открытый порт в подсети', async () => {
  const { srv, port } = await listen(net.createServer((s) => s.end()));
  const rp = new RawPrinter({ psDir: '.', platform: 'linux' });
  const found = await rp.discover('127.0.0', { waitMs: 300, port });
  assert.deepEqual(found, ['127.0.0.1']);
  await new Promise((r) => srv.close(r));
});

test('rawprint: CUPS-ветка вызывает lp с -o raw и удаляет временный файл', async () => {
  const calls = [];
  const rp = new RawPrinter({ psDir: '.', platform: 'linux', execFn: (file, args, o, cb) => { calls.push([file, ...args]); cb(null, file === 'lpstat' ? 'POS-80\nHP\n' : '', ''); } });
  const list = await rp.list();
  assert.deepEqual(list.map((p) => p.name), ['POS-80', 'HP']);
  await rp.print('POS-80', Buffer.from('abc'));
  const lp = calls.find((c) => c[0] === 'lp');
  assert.deepEqual(lp.slice(0, 5), ['lp', '-d', 'POS-80', '-o', 'raw']);
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(!require('fs').existsSync(lp[5]), 'временный файл удалён');
});

test('rawprint (Windows): реальный PowerShell-процесс отдаёт список принтеров; печать на несуществующий принтер → ошибка', { skip: process.platform !== 'win32' }, async () => {
  const rp = new RawPrinter({ psDir: path.join(__dirname, '..', 'lib', 'ps') });
  try {
    const list = await rp.list();
    assert.ok(Array.isArray(list));
    for (const p of list) assert.ok(typeof p.name === 'string' && 'score' in p);
    await assert.rejects(() => rp.print('NO-SUCH-PRINTER-' + Date.now(), Buffer.from('x')), /OpenPrinter|NO-SUCH/);
    // после ошибки процесс продолжает отвечать
    assert.ok(Array.isArray(await rp.list()));
  } finally { rp.close(); }
});
