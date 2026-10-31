// @ts-check
'use strict';
/** Core local sale ledger. No network calls and no Electron dependency. */
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DECIMALS = { KZT: 0, RUB: 2, KGS: 2, UZS: 0, BYN: 2, UAH: 2, TJS: 2, AMD: 0, AZN: 2, GEL: 2, MDL: 2, TRY: 2, USD: 2, EUR: 2, PEN: 2 };

/** @param {unknown} amount @param {number} decimals */
function minorUnits(amount, decimals) {
  const str = String(amount);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match || ((match[2] || '').length > decimals && /[1-9]/.test((match[2] || '').slice(decimals)))) throw new Error('Некорректная цена товара');
  const n = Number(match[1]) * 10 ** decimals + Number((match[2] || '').slice(0, decimals).padEnd(decimals, '0'));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Цена товара слишком велика');
  return n;
}

/** @param {import('node:sqlite').DatabaseSync} db @param {() => any} fn */
function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

class OfflineSales {
  /** @param {string} databasePath @param {string} deviceId */
  constructor(databasePath, deviceId) {
    if (!/^[0-9a-f-]{36}$/i.test(deviceId)) throw new Error('Неверный ID устройства');
    this.db = new DatabaseSync(databasePath);
    this.deviceId = deviceId;
    try {
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
      const meta = this.db.prepare("SELECT value FROM metadata WHERE key='restaurantId'").get();
      if (!meta) throw new Error('Локальная база каталога не инициализирована');
      this.restaurantId = String(meta.value);
      const row = this.db.prepare("SELECT data FROM catalog WHERE kind='Restaurante' AND id=?").get(this.restaurantId);
      const restaurant = row ? JSON.parse(String(row.data)) : null;
      this.currency = Object.hasOwn(DECIMALS, restaurant?.moneda) ? restaurant.moneda : 'KZT';
      this.decimals = DECIMALS[this.currency];
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS local_orders (
          number INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          request_id TEXT NOT NULL UNIQUE,
          request_hash TEXT NOT NULL,
          restaurant_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('EN_MESA','PARA_LLEVAR')),
          table_id TEXT,
          employee_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('OPEN','PAID','CANCELLED')),
          subtotal_minor INTEGER NOT NULL,
          total_minor INTEGER NOT NULL,
          currency TEXT NOT NULL,
          created_at TEXT NOT NULL,
          paid_at TEXT,
          payment_method TEXT,
          payment_request_id TEXT UNIQUE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS local_open_table ON local_orders(table_id) WHERE status='OPEN' AND table_id IS NOT NULL;
        CREATE TABLE IF NOT EXISTS local_order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES local_orders(id),
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK(quantity > 0),
          price_minor INTEGER NOT NULL,
          subtotal_minor INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_outbox (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE,
          restaurant_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          synced_at TEXT
        );
        CREATE INDEX IF NOT EXISTS local_outbox_pending ON local_outbox(synced_at,seq);
      `);
    } catch (error) { this.db.close(); throw error; }
  }

  close() { this.db.close(); }

  /** @param {string} kind @param {Record<string, unknown>} payload @param {string} at */
  appendEvent(kind, payload, at) {
    this.db.prepare('INSERT INTO local_outbox (event_id,restaurant_id,device_id,kind,payload,created_at) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), this.restaurantId, this.deviceId, kind, JSON.stringify(payload), at);
  }

  /** @param {{requestId:string,type:'EN_MESA'|'PARA_LLEVAR',tableId?:string|null,employeeId:string,items:{productId:string,quantity:number}[]}} input */
  createOrder(input) {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.requestId || '')) throw new Error('Нужен ID запроса');
    if (!['EN_MESA', 'PARA_LLEVAR'].includes(input.type) || !input.employeeId || !Array.isArray(input.items) || !input.items.length) throw new Error('Некорректный заказ');
    if (input.type === 'EN_MESA' && !input.tableId || input.type === 'PARA_LLEVAR' && input.tableId) throw new Error('Неверный стол');
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ type: input.type, tableId: input.tableId || null, employeeId: input.employeeId, items: input.items })).digest('hex');
    return transaction(this.db, () => {
      const existing = this.db.prepare('SELECT id,request_hash FROM local_orders WHERE request_id=?').get(input.requestId);
      if (existing) {
        if (existing.request_hash !== requestHash) throw new Error('ID запроса уже использован для другого заказа');
        return this.getOrder(String(existing.id));
      }
      if (input.tableId) {
        const table = this.db.prepare("SELECT 1 FROM catalog WHERE kind='Mesa' AND id=?").get(input.tableId);
        if (!table) throw new Error('Стол не найден');
      }
      const lines = input.items.map((item) => {
        if (!item || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 999) throw new Error('Неверное количество');
        const row = this.db.prepare("SELECT data FROM catalog WHERE kind='Producto' AND id=?").get(item.productId);
        if (!row) throw new Error('Товар не найден');
        const product = JSON.parse(String(row.data));
        if (product.restauranteId !== this.restaurantId || product.disponible === 'f' || product.disponible === false) throw new Error('Товар недоступен');
        const price = minorUnits(product.precio, this.decimals);
        const subtotal = price * item.quantity;
        if (!Number.isSafeInteger(subtotal)) throw new Error('Сумма слишком велика');
        return { productId: item.productId, name: product.nombre, quantity: item.quantity, price, subtotal };
      });
      const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
      if (!Number.isSafeInteger(total)) throw new Error('Сумма слишком велика');
      const id = crypto.randomUUID();
      const at = new Date().toISOString();
      this.db.prepare('INSERT INTO local_orders (id,request_id,request_hash,restaurant_id,device_id,type,table_id,employee_id,status,subtotal_minor,total_minor,currency,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, input.requestId, requestHash, this.restaurantId, this.deviceId, input.type, input.tableId || null, input.employeeId, 'OPEN', total, total, this.currency, at);
      const insertItem = this.db.prepare('INSERT INTO local_order_items (id,order_id,product_id,product_name,quantity,price_minor,subtotal_minor) VALUES (?,?,?,?,?,?,?)');
      for (const line of lines) insertItem.run(crypto.randomUUID(), id, line.productId, line.name, line.quantity, line.price, line.subtotal);
      const order = this.getOrder(id);
      this.appendEvent('order.created', { order }, at);
      return order;
    });
  }

  /** @param {string} id @returns {any} */
  getOrder(id) {
    const order = /** @type {Record<string, any> | undefined} */ (this.db.prepare('SELECT * FROM local_orders WHERE id=? AND restaurant_id=?').get(id, this.restaurantId));
    if (!order) return null;
    const items = this.db.prepare('SELECT product_id,product_name,quantity,price_minor,subtotal_minor FROM local_order_items WHERE order_id=? ORDER BY rowid').all(id);
    return { ...order, items };
  }

  /** @param {{orderId:string,requestId:string,method:string,expectedTotalMinor:number}} input */
  payOrder(input) {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.requestId || '') || !['Efectivo', 'Tarjeta', 'QR', 'Transferencia'].includes(input.method)) throw new Error('Некорректная оплата');
    return transaction(this.db, () => {
      const order = this.getOrder(input.orderId);
      if (!order) throw new Error('Заказ не найден');
      if (order.status === 'PAID') {
        if (order.payment_request_id === input.requestId && order.payment_method === input.method) return order;
        throw new Error('Заказ уже оплачен');
      }
      if (order.status !== 'OPEN') throw new Error('Заказ закрыт');
      if (input.expectedTotalMinor !== order.total_minor) throw new Error('Сумма заказа изменилась');
      const at = new Date().toISOString();
      this.db.prepare("UPDATE local_orders SET status='PAID',paid_at=?,payment_method=?,payment_request_id=? WHERE id=? AND status='OPEN'")
        .run(at, input.method, input.requestId, input.orderId);
      const paid = this.getOrder(input.orderId);
      this.appendEvent('order.paid', { orderId: input.orderId, number: order.number, totalMinor: order.total_minor, currency: order.currency, method: input.method, paidAt: at }, at);
      return paid;
    });
  }

  pendingEvents(limit = 100) {
    return this.db.prepare('SELECT seq,event_id,restaurant_id,device_id,kind,payload,created_at FROM local_outbox WHERE synced_at IS NULL ORDER BY seq LIMIT ?').all(Math.max(1, Math.min(500, limit)));
  }

  /** Mark only events explicitly acknowledged by the remote server. */
  acknowledge(eventId) {
    return this.db.prepare('UPDATE local_outbox SET synced_at=? WHERE event_id=? AND synced_at IS NULL').run(new Date().toISOString(), eventId).changes;
  }
}

module.exports = { OfflineSales, minorUnits };
