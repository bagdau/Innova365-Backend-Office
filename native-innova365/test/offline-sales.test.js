'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importCatalog } = require('../lib/offline-catalog');
const { OfflineSales, minorUnits } = require('../lib/offline-sales');

const DEVICE = '11111111-1111-4111-8111-111111111111';
const request = (n) => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;

test('offline sale and payment survive restart; duplicate calls do not double charge', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-offline-sale-'));
  const dump = path.join(dir, 'dump.sql');
  const dbPath = path.join(dir, 'pos.sqlite');
  fs.writeFileSync(dump, [
    'COPY public."Restaurante" (id, nombre, moneda) FROM stdin;', 'r1\tCafe\tKZT', '\\.',
    'COPY public."Mesa" (id, numero, "restauranteId") FROM stdin;', 'm1\t1\tr1', '\\.',
    'COPY public."Producto" (id, nombre, precio, disponible, "restauranteId") FROM stdin;', 'p1\tПлов\t1200.00\tt\tr1', '\\.',
  ].join('\n'));
  try {
    importCatalog(dump, dbPath);
    let sales = new OfflineSales(dbPath, DEVICE);
    const payload = { requestId: request(1), type: 'EN_MESA', tableId: 'm1', employeeId: 'u1', items: [{ productId: 'p1', quantity: 2 }] };
    const created = sales.createOrder(payload);
    assert.equal(created.total_minor, 2400);
    assert.equal(created.number, 1);
    assert.equal(sales.createOrder(payload).id, created.id);
    assert.throws(() => sales.createOrder({ ...payload, items: [{ productId: 'p1', quantity: 1 }] }), /ID запроса уже использован/);
    assert.equal(sales.pendingEvents().length, 1);
    assert.throws(() => sales.createOrder({ ...payload, requestId: request(2) }), /UNIQUE constraint/);
    assert.equal(sales.pendingEvents().length, 1);
    assert.throws(() => sales.payOrder({ orderId: created.id, requestId: request(3), method: 'Efectivo', expectedTotalMinor: 1 }), /Сумма заказа изменилась/);
    assert.equal(sales.getOrder(created.id).status, 'OPEN');
    assert.equal(sales.pendingEvents().length, 1);
    sales.close();
    sales = new OfflineSales(dbPath, DEVICE);
    const payment = { orderId: created.id, requestId: request(3), method: 'Efectivo', expectedTotalMinor: 2400 };
    assert.equal(sales.payOrder(payment).status, 'PAID');
    assert.equal(sales.payOrder(payment).status, 'PAID');
    assert.throws(() => sales.payOrder({ ...payment, requestId: request(4) }), /уже оплачен/);
    assert.equal(sales.pendingEvents().length, 2);
    const first = sales.pendingEvents()[0];
    assert.equal(sales.acknowledge(first.event_id), 1);
    assert.equal(sales.acknowledge(first.event_id), 0);
    assert.equal(sales.pendingEvents().length, 1);
    sales.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('money amounts reject fractional KZT and unsafe values', () => {
  assert.equal(minorUnits('12.00', 0), 12);
  assert.equal(minorUnits('12.50', 2), 1250);
  assert.throws(() => minorUnits('12.50', 0), /цена/);
  assert.throws(() => minorUnits('9007199254740993', 0), /слишком велика/);
});
