'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const { PrintRouter, ipFromPort } = require('../lib/print-router');
const { PrintQueue } = require('../lib/print-queue');
const { RawPrinter, describeStatus } = require('../lib/rawprint');
const { classifyAll } = require('../lib/printers');

/** Очереди заведения Meyiz: сетевые XP-80C на портах Windows и USB-принтер check. */
const VENUE = [
  { name: 'samsa', port: '192.168.123.87', driver: 'XP-80C' },
  { name: 'kuhnya', port: 'IP_192.168.123.89', driver: 'XP-80C' },
  { name: 'bar', port: '192.168.123.88', driver: 'XP-80C' },
  { name: 'check', port: 'USB001', driver: '80Normal', isDefault: true },
  { name: 'Old', port: 'USB002', driver: 'XP-80C', offline: true },
  { name: 'OneNote for Windows 10', port: 'Microsoft.Office.OneNote', driver: 'Microsoft Software Printer Driver' },
];

/** Подставная ОС: запоминает отправленное; сеть и спулер можно «сломать». */
function fakeOs({ spoolerFails = 0, tcpDown = false, list = VENUE, listThrows = false } = {}) {
  const f = {
    spool: [], tcp: [], spoolerFails,
    async list() { if (listThrows) throw new Error('worker stopped'); return classifyAll(list); },
    async print(name, data) { if (f.spoolerFails > 0) { f.spoolerFails--; throw new Error('WritePrinter: 1722'); } f.spool.push({ name, data }); },
    async relay(host, port, data) { if (tcpDown) throw new Error(`printer ${host}:${port}: ECONNREFUSED`); f.tcp.push({ host, port, data }); },
  };
  return f;
}
const router = (o, opts = {}) => new PrintRouter({ printer: o, retryDelayMs: 1, ...opts });
const DATA = Buffer.from([0x1b, 0x40, 0x41, 0x0a, 0x1d, 0x56, 0x00]);

test('ipFromPort: порты TCP/IP Windows и не-сетевые порты', () => {
  assert.equal(ipFromPort('192.168.123.87'), '192.168.123.87');
  assert.equal(ipFromPort('IP_192.168.123.89'), '192.168.123.89');
  assert.equal(ipFromPort('IP_10.0.0.5_1'), '10.0.0.5');
  assert.equal(ipFromPort('USB001'), null);
  assert.equal(ipFromPort('WSD-1234'), null);
  assert.equal(ipFromPort('8.8.8.8'), null, 'публичные адреса не используются');
});

test('router: очередь с IP-портом печатает напрямую на 9100, USB — через спулер', async () => {
  const o = fakeOs();
  const r = router(o);
  const a = await r.send('kuhnya', DATA);
  assert.equal(a.via, 'tcp'); assert.deepEqual(o.tcp[0], { host: '192.168.123.89', port: 9100, data: DATA }); assert.equal(o.spool.length, 0);
  const b = await r.send('check', DATA);
  assert.equal(b.via, 'spooler'); assert.equal(o.spool[0].name, 'check');
});

test('router: сеть недоступна → запасной путь через спулер Windows', async () => {
  const o = fakeOs({ tcpDown: true });
  const res = await router(o).send('bar', DATA);
  assert.equal(res.via, 'spooler');
  assert.deepEqual(res.attempts.map((x) => [x.via, x.ok]), [['tcp', false], ['spooler', true]]);
});

test('router: единичный сбой спулера повторяется, два подряд — понятная ошибка с попытками', async () => {
  const one = fakeOs({ spoolerFails: 1 });
  assert.equal((await router(one).send('check', DATA)).via, 'spooler');
  const two = fakeOs({ spoolerFails: 5 });
  await assert.rejects(router(two).send('check', DATA), (e) => e.code === 'failed' && e.attempts.length === 2 && /check/.test(e.message));
});

test('router: несуществующая очередь (POS-80) → not_found со списком доступных, без OneNote', async () => {
  await assert.rejects(router(fakeOs()).send('POS-80', DATA), (e) => {
    assert.equal(e.code, 'not_found');
    assert.deepEqual(e.available.slice(0, 4), ['samsa', 'kuhnya', 'bar', 'check']);
    assert.ok(!e.available.includes('OneNote for Windows 10'));
    return /POS-80/.test(e.message) && /check/.test(e.message);
  });
  assert.equal((await router(fakeOs()).send(' CHECK ', DATA)).printer, 'check', 'регистр и пробелы не важны');
});

test('router: автономный USB-принтер не принимает задание молча', async () => {
  await assert.rejects(router(fakeOs()).send('Old', DATA), (e) => e.code === 'offline');
});

test('router: список очередей недоступен → не блокируем печать, шлём в спулер по имени', async () => {
  const o = fakeOs({ listThrows: true });
  assert.equal((await router(o).send('check', DATA)).via, 'spooler');
  assert.equal(o.spool[0].name, 'check');
});

test('router + эмулятор IP-принтера: байты ESC/POS доходят целиком и без искажений', async () => {
  const got = [];
  const srv = net.createServer((s) => { const c = []; s.on('data', (d) => c.push(d)); s.on('end', () => got.push(Buffer.concat(c))); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const real = new RawPrinter({ psDir: '.', platform: 'linux' });
  // реальная ретрансляция по TCP на эмулятор; порт принтера подменён только в этом тесте
  const o = { ...fakeOs(), relay: (_h, _p, d) => real.relay('127.0.0.1', srv.address().port, d, { settleMs: 20 }) };
  const big = Buffer.concat([Buffer.from([0x1b, 0x40]), Buffer.alloc(60_000, 0x41), Buffer.from([0x1d, 0x56, 0x00])]);
  const res = await router(o).send('samsa', big);
  await new Promise((r) => setTimeout(r, 80));
  srv.close();
  assert.equal(res.via, 'tcp');
  assert.ok(got[0].equals(big), 'принтер получил ровно те же байты');
});

test('status: расшифровка кодов Windows', () => {
  assert.equal(describeStatus({ errorState: 4, workOffline: false, stuckJobs: 0 }).text, 'нет бумаги');
  assert.equal(describeStatus({ errorState: 4 }).problem, true);
  assert.equal(describeStatus({ errorState: 3 }).problem, false, 'бумага заканчивается — предупреждение, не отказ');
  assert.equal(describeStatus({ errorState: 2, workOffline: true }).problem, true);
  assert.equal(describeStatus({ errorState: 2, workOffline: false, stuckJobs: 0 }).problem, false);
  assert.match(describeStatus({ errorState: 2, stuckJobs: 2 }).text, /застряло/);
});

test('queue: задание переживает отказ принтера и перезапуск, печатается по порядку', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pq-'));
  const o = fakeOs({ spoolerFails: 99 });
  const now = 1_000_000;
  const q1 = new PrintQueue({ dir, router: router(o), now: () => now });
  const a = await q1.enqueue('check', Buffer.from('первый'));
  await q1.enqueue('check', Buffer.from('второй'));
  assert.equal(a.queued, true); assert.equal(q1.list().length, 2); assert.match(q1.list()[0].lastError, /check/);
  // «перезапуск» кассы + принтер ожил
  o.spoolerFails = 0;
  const q2 = new PrintQueue({ dir, router: router(o), now: () => now });
  await q2.pump();
  assert.deepEqual(o.spool.map((j) => j.data.toString()), ['первый', 'второй']);
  assert.equal(q2.list().length, 0);
});

test('queue: дубликат по ключу не печатается дважды; просроченное задание отбрасывается', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pq-'));
  const o = fakeOs({ spoolerFails: 99 });
  let now = 5_000;
  const q = new PrintQueue({ dir, router: router(o), now: () => now, maxAgeMs: 60_000 });
  await q.enqueue('check', Buffer.from('чек 42'), { key: 'order-42' });
  assert.equal((await q.enqueue('check', Buffer.from('чек 42'), { key: 'order-42' })).duplicate, true);
  assert.equal(q.list().length, 1);
  now += 61_000; await q.pump();
  assert.equal(q.list().length, 0); assert.equal(q.failed.length, 1); assert.equal(q.failed[0].expired, true);
});
