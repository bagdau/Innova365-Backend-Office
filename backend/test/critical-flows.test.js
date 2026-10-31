const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { prisma } = require('../dist/prisma');
const { login, refresh } = require('../dist/controllers/auth.controller');
const { loginSchema, createUsuarioSchema } = require('../dist/schemas');
const { createPedido, addItemsToPedido, updateEstadoPedido, registrarPago } = require('../dist/controllers/pedidos.controller');
const { getProductividad } = require('../dist/controllers/reportes.controller');
const printService = require('../dist/print/print.service');
const { elegirMejor } = require('../dist/print/transport');
const { loadCashReport, cashReportRange } = require('../dist/print/cash-report');
const { closingDoc, receiptDoc } = require('../dist/print/templates');
const { EscPos } = require('../dist/print/escpos');
const { printSettings } = require('../dist/print/settings');
const { updateRestauranteSchema } = require('../dist/schemas');
const { expandir, netAfterProcessing, descontarItems } = require('../dist/recetas');
const iconv = require('iconv-lite');
const bcrypt = require('bcryptjs');
const { pinKey } = require('../dist/pin');
const { fillDailySales } = require('../dist/reports/daily-sales');
const { serviceCharge } = require('../dist/service-charge');
const { Prisma } = require('@prisma/client');

test('процент обслуживания округляется до тиына и печатается отдельно от блюд', () => {
  assert.equal(serviceCharge(new Prisma.Decimal('1300.00'), new Prisma.Decimal('10.00')).toString(), '130');
  assert.equal(serviceCharge(new Prisma.Decimal('10.05'), new Prisma.Decimal('7.5')).toString(), '0.75');
  assert.equal(serviceCharge(new Prisma.Decimal('1300'), new Prisma.Decimal('7.5'), 0).toString(), '98');
  const p = {
    numero: 22, tipo: 'EN_MESA', estado: 'PAGADO', metodoPago: 'Efectivo',
    total: 1430, servicePercent: 10, serviceAmount: 130, pagadoEn: new Date(2026, 9, 28, 12, 15),
    creadoEn: new Date(2026, 9, 28, 11, 0), mesa: { numero: 4 },
    items: [{ cantidad: 1, precio: 1300, subtotal: 1300, producto: { nombre: 'Плов', requiereCocina: true } }],
  };
  const bytes = receiptDoc({ nombre: 'Aisultan', moneda: 'KZT' }, p, { cols: 33, cp: 'cp866', lang: 'ru', cut: false, drawer: false }, 'recibo');
  const printed = iconv.decode(bytes, 'cp866');
  assert.match(printed, /Блюда\s+1300\b/);
  assert.match(printed, /Обслуживание 10%\s+130\b/);
  assert.match(printed, /ИТОГО\s+1430\b/);
  assert.match(printed, /Дата: 28\.10\.2026 12:15/);
});

test('назначенному официанту начисляется процент при создании и добавлении позиций', async (t) => {
  const oldProducts = prisma.producto.findMany, oldOrder = prisma.pedido.findFirst, oldTransaction = prisma.$transaction, oldPrint = printService.autoImprimir;
  t.after(() => { prisma.producto.findMany = oldProducts; prisma.pedido.findFirst = oldOrder; prisma.$transaction = oldTransaction; printService.autoImprimir = oldPrint; });
  prisma.producto.findMany = async () => [{ id: 'dish', precio: 1000, requiereCocina: false }];
  let created;
  prisma.$transaction = async (work) => work({
    pedido: { count: async () => 0, create: async ({ data }) => { created = data; return { id: 'order', numero: 1, estado: 'LISTO', items: [] }; } },
    mesa: { updateMany: async () => ({ count: 1 }) },
    restaurante: { findUnique: async () => ({ moneda: 'KZT' }) },
    usuario: { findFirst: async ({ where }) => { assert.equal(where.id, 'waiter'); return { rol: 'MESERO', activo: true, waiterPercent: new Prisma.Decimal(10) }; } },
  });
  await createPedido({ body: { tipo: 'EN_MESA', mesaId: 'table', meseroId: 'waiter', items: [{ productoId: 'dish', cantidad: 1 }] }, restauranteId: 'rest', user: { userId: 'admin', rol: 'ADMIN' } }, { status() { return this; }, json() {} });
  assert.equal(created.meseroId, 'waiter');
  assert.equal(created.total.toString(), '1100');
  assert.equal(created.serviceAmount.toString(), '100');

  const current = { id: 'order', numero: 1, estado: 'ENTREGADO', total: new Prisma.Decimal(1100), servicePercent: new Prisma.Decimal(10), serviceAmount: new Prisma.Decimal(100), serviceDecimals: 0 };
  prisma.pedido.findFirst = async () => current;
  prisma.producto.findMany = async () => [{ id: 'drink', precio: 300, requiereCocina: false }];
  let update;
  prisma.$transaction = async (work) => work({
    pedido: { findFirst: async () => current, updateMany: async ({ data }) => { update = data; return { count: 1 }; }, findUniqueOrThrow: async () => ({ id: 'order' }) },
    itemPedido: { createManyAndReturn: async () => [] },
  });
  printService.autoImprimir = () => {};
  await addItemsToPedido({ params: { id: 'order' }, body: { items: [{ productoId: 'drink', cantidad: 1 }] }, restauranteId: 'rest', user: { userId: 'admin' } }, { json() {} });
  assert.equal(update.serviceAmount.toString(), '130');
  assert.equal(update.total.increment.toString(), '330');
});

test('касса не закрывает заказ, если сумма выросла после открытия оплаты', async (t) => {
  const oldTransaction = prisma.$transaction;
  t.after(() => { prisma.$transaction = oldTransaction; });
  prisma.$transaction = async (work) => work({
    usuario: { findFirst: async () => ({ nombre: 'Кассир', rol: 'CAJERO' }) },
    pedido: {
      updateMany: async ({ where }) => { assert.equal(where.total, 1100); return { count: 0 }; },
      findFirst: async () => ({ id: 'order', estado: 'ENTREGADO', total: new Prisma.Decimal(1430) }),
    },
  });
  await assert.rejects(registrarPago({ params: { id: 'order' }, body: { metodoPago: 'Efectivo', expectedTotal: 1100 }, restauranteId: 'rest', user: { userId: 'cashier' } }, {}), (error) => error.status === 409 && /Сумма заказа изменилась/.test(error.message));
});

test('график продаж показывает дни без заказов с учётом часового пояса', () => {
  const series = fillDailySales(
    [{ fecha: '2026-10-27', ventas: 300, pedidos: 1 }],
    new Date('2026-10-25T19:00:00.000Z'),
    new Date('2026-10-27T12:00:00.000Z'),
    'Asia/Almaty',
  );
  assert.deepEqual(series, [
    { fecha: '2026-10-26', ventas: 0, pedidos: 0 },
    { fecha: '2026-10-27', ventas: 300, pedidos: 1 },
  ]);
});

test('PIN принимает ровно четыре цифры и сохраняется только в виде хеша', async (t) => {
  assert.equal(loginSchema.safeParse({ email: 'cashier@example.com', pin: '0123' }).success, true);
  assert.equal(loginSchema.safeParse({ pin: '0123' }).success, true);
  assert.equal(loginSchema.safeParse({ password: 'password' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'cashier@example.com', pin: '123' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'cashier@example.com', pin: '12a4' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'cashier@example.com', password: 'password', pin: '0123' }).success, false);
  assert.equal(createUsuarioSchema.safeParse({ nombre: 'Кассир', email: 'cashier@example.com', password: 'password', rol: 'CAJERO', pin: '0000' }).success, true);

  const oldFind = prisma.usuario.findUnique, oldUpdate = prisma.usuario.update, oldAudit = prisma.registroActividad.create;
  t.after(() => { prisma.usuario.findUnique = oldFind; prisma.usuario.update = oldUpdate; prisma.registroActividad.create = oldAudit; });
  process.env.JWT_SECRET ||= 'test-access-secret';
  process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';
  const user = { id: 'pin-user', nombre: 'Кассир', email: 'cashier@example.com', rol: 'CAJERO', activo: true,
    restauranteId: 'rest-pin', restaurante: { id: 'rest-pin', nombre: 'Cafe' },
    passwordHash: await bcrypt.hash('password', 4), pinHash: await bcrypt.hash('0123', 4), pinKey: pinKey('0123'), pinAttempts: 0, pinLockedUntil: null };
  prisma.usuario.findUnique = async ({ where }) => where.pinKey && where.pinKey !== user.pinKey ? null : user;
  prisma.usuario.update = async ({ data }) => {
    if (data.pinAttempts?.increment) user.pinAttempts += data.pinAttempts.increment;
    else if (data.pinAttempts !== undefined) user.pinAttempts = data.pinAttempts;
    if (data.pinLockedUntil !== undefined) user.pinLockedUntil = data.pinLockedUntil;
    return { pinAttempts: user.pinAttempts };
  };
  prisma.registroActividad.create = async () => ({});
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, cookie() { return this; } });
  const good = response();
  await login({ body: { email: user.email, pin: '0123' } }, good);
  assert.equal(good.body.user.rol, 'CAJERO');
  assert.ok(good.body.accessToken);
  assert.equal(JSON.stringify(good.body).includes('pinHash'), false);
  const pinOnly = response();
  await login({ body: { pin: '0123' } }, pinOnly);
  assert.equal(pinOnly.statusCode, 200);
  assert.equal(pinOnly.body.user.email, user.email);
  for (let i = 0; i < 5; i++) {
    const bad = response();
    await login({ body: { email: user.email, pin: '9999' } }, bad);
    assert.equal(bad.statusCode, 401);
  }
  assert.ok(user.pinLockedUntil > new Date());
  const blocked = response();
  await login({ body: { email: user.email, pin: '0123' } }, blocked);
  assert.equal(blocked.statusCode, 429);
  const fallback = response();
  await login({ body: { email: user.email, password: 'password' } }, fallback);
  assert.equal(fallback.statusCode, 200);
});

test('ESC/POS выводит XP-76 из китайского режима до кириллицы CP866', () => {
  const bytes = new EscPos(32, 'cp866').line('Привет').build();
  assert.deepEqual([...bytes.subarray(0, 7)], [0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, 17]);
  assert.deepEqual(bytes.subarray(7), Buffer.concat([iconv.encode('Привет', 'cp866'), Buffer.from([0x0a])]));
});

test('знак тенге передаётся графикой, а настройки старого ресторана получают новые значения', () => {
  const bytes = new EscPos(33, 'cp866').line('Итого 1100 ₸').build();
  assert.ok(bytes.includes(Buffer.from([0x1b, 0x2a, 0, 9, 0])), 'знак ₸ рисуется 9-точечной графикой');
  assert.ok(!bytes.includes(Buffer.from('KZT')));
  assert.equal(printSettings(null).receipt.showAddress, false);
  assert.equal(printSettings(null).receipt.footer, 'Автоматизировано с помощью Innova365');
});

test('чек XP-76 печатает дату оплаты, колонки и выбранные поля без адреса и телефона', () => {
  const order = {
    numero: 21, tipo: 'EN_MESA', estado: 'PAGADO', metodoPago: 'QR', total: 1300,
    creadoEn: new Date(2026, 9, 27, 16, 0), actualizadoEn: new Date(2026, 9, 27, 17, 7),
    mesa: { numero: 2 }, cajeroNombre: 'Алия', cajeroRol: 'CAJERO',
    items: [{ cantidad: 1, precio: 1300, subtotal: 1300, producto: { nombre: 'Coca-Cola 1,5 л', requiereCocina: false } }],
  };
  const cfg = { nombre: 'Aisultan', direccion: 'Скрытый адрес', телефон: '+77770000000', moneda: 'KZT',
    printSettings: { receipt: { ...printSettings(null).receipt, showQr: false } } };
  const bytes = receiptDoc(cfg, order, { cols: 33, cp: 'cp866', lang: 'ru', cut: false, drawer: false }, 'recibo');
  const printed = iconv.decode(bytes, 'cp866');
  assert.match(printed, /Дата: 27\.10\.2026 17:07/);
  assert.match(printed, /Стол: 2/);
  assert.match(printed, /Наименование\s+Кол-во\s+Цена\s+Сумма/);
  assert.match(printed, /Безналичные/);
  assert.match(printed, /Автоматизировано с помощью\s+Innova365/);
  assert.doesNotMatch(printed, /Скрытый адрес|77770000000|16:00|KZT/);
  assert.ok(!bytes.includes(Buffer.from([0x1d, 0x28, 0x6b])), 'отключённый QR не отправляется принтеру');
});

test('сервер принимает только допустимые настройки печати', () => {
  const valid = updateRestauranteSchema.safeParse({ printSettings: printSettings(null) });
  assert.equal(valid.success, true);
  const invalid = updateRestauranteSchema.safeParse({ printSettings: {
    ...printSettings(null), receipt: { ...printSettings(null).receipt, width: 999 },
  } });
  assert.equal(invalid.success, false);
});

test('неделя отчёта начинается в понедельник даже на границе месяца', () => {
  const sunday = cashReportRange('semana', new Date(2026, 10, 1, 12));
  assert.equal(sunday.from.getFullYear(), 2026);
  assert.equal(sunday.from.getMonth(), 9);
  assert.equal(sunday.from.getDate(), 26);
  assert.equal(sunday.from.getHours(), 0);
  const monday = cashReportRange('semana', new Date(2026, 10, 2, 12));
  assert.equal(monday.from.getDate(), 2);
});

test('автовыбор не отправляет чек на офисный принтер', () => {
  assert.equal(elegirMejor([{ name: 'HP LaserJet MFP M129', port: 'USB002', isDefault: true }]), null);
  assert.equal(elegirMejor([{ name: 'HP LaserJet', port: 'USB002' }, { name: 'XP-80C', port: 'USB001' }]), 'XP-80C');
});

test('две порции комбо списывают двойное брутто, обработка меняет только нетто', () => {
  const map = {
    plov: { items: [{ insumoId: 'rice', componenteId: null, cantidad: 0.2 }, { insumoId: null, componenteId: 'sauce', cantidad: 1 }] },
    sauce: { items: [{ insumoId: 'oil', componenteId: null, cantidad: 0.03 }] },
  };
  const ingredients = expandir(map, 'plov', 2);
  assert.equal(ingredients.get('rice'), 0.4);
  assert.equal(ingredients.get('oil'), 0.06);
  assert.equal(netAfterProcessing(0.2, 20, 10), 0.144);
});

test('создание заказа списывает две порции по брутто и записывает движение склада', async () => {
  let debit;
  let movement;
  let marked;
  const tx = {
    receta: { findMany: async () => [{ productoId: 'plov', items: [{ insumoId: 'rice', componenteId: null, cantidad: 0.2 }] }] },
    $queryRaw: async (_sql, quantity, ingredient, restaurant) => {
      debit = { quantity, ingredient, restaurant };
      return [{ saldo: 9.6, costo: 100 }];
    },
    movimientoInventario: { create: async ({ data }) => { movement = data; } },
    itemPedido: { updateMany: async ({ where, data }) => { marked = { where, data }; } },
  };
  await descontarItems(tx, 'restaurant-1', { id: 'order-1', numero: 7 }, [{ id: 'item-1', productoId: 'plov', cantidad: 2 }], 'cashier-1');
  assert.deepEqual(debit, { quantity: 0.4, ingredient: 'rice', restaurant: 'restaurant-1' });
  assert.equal(movement.cantidad, -0.4);
  assert.equal(movement.tipo, 'CONSUMO');
  assert.equal(movement.pedidoId, 'order-1');
  assert.deepEqual(marked, { where: { id: { in: ['item-1'] } }, data: { descontado: true } });
});

test('занятый стол не открывает второй заказ даже при ошибочном свободном статусе', async (t) => {
  const oldProducts = prisma.producto.findMany;
  const oldTransaction = prisma.$transaction;
  t.after(() => { prisma.producto.findMany = oldProducts; prisma.$transaction = oldTransaction; });
  prisma.producto.findMany = async () => [{ id: 'drink-1', precio: 700, requiereCocina: false }];
  let created = false;
  prisma.$transaction = async (work) => work({
    pedido: { count: async () => 1, create: async () => { created = true; } },
    mesa: { updateMany: async () => { throw new Error('Стол не должен изменяться'); } },
  });
  await assert.rejects(
    createPedido({ body: { tipo: 'EN_MESA', mesaId: 'table-2', items: [{ productoId: 'drink-1', cantidad: 1 }] }, restauranteId: 'rest-1', user: { userId: 'waiter-1' } }, {}),
    (error) => error.status === 409,
  );
  assert.equal(created, false);
});

test('refresh берёт изменённую роль из базы, а не из старой cookie', async (t) => {
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_SECRET = 'test-access-secret';
  const user = {
    id: 'user-1', restauranteId: 'restaurant-1', rol: 'MESERO', email: 'user@example.com',
    nombre: 'Test', activo: true, restaurante: { id: 'restaurant-1', nombre: 'Test' },
  };
  const findUnique = prisma.usuario.findUnique;
  prisma.usuario.findUnique = async () => user;
  t.after(() => { prisma.usuario.findUnique = findUnique; });
  const oldToken = jwt.sign({ userId: user.id, restauranteId: user.restauranteId, rol: 'ADMIN', email: user.email }, process.env.JWT_REFRESH_SECRET);
  let result;
  let cookie;
  const res = {
    cookie: (_name, value) => { cookie = value; return res; },
    json: (body) => { result = body; return res; },
    clearCookie: () => res,
  };

  await refresh({ cookies: { refreshToken: oldToken } }, res);

  assert.equal(result.user.rol, 'MESERO');
  assert.equal(jwt.verify(result.accessToken, process.env.JWT_SECRET).rol, 'MESERO');
  assert.equal(jwt.verify(cookie, process.env.JWT_REFRESH_SECRET).rol, 'MESERO');
});

test('устаревший статус заказа не запускает побочные действия', async (t) => {
  const before = new Date('2026-01-01T00:00:00Z');
  const findFirst = prisma.pedido.findFirst;
  const transaction = prisma.$transaction;
  t.after(() => { prisma.pedido.findFirst = findFirst; prisma.$transaction = transaction; });
  prisma.pedido.findFirst = async () => ({ id: 'order-1', numero: 1, estado: 'EN_COCINA', actualizadoEn: before });
  let updatedItems = false;
  prisma.$transaction = async (work) => work({
    pedido: { updateMany: async ({ where }) => {
      assert.equal(where.estado, 'EN_COCINA');
      assert.deepEqual(where.actualizadoEn, before);
      return { count: 0 };
    } },
    itemPedido: { updateMany: async () => { updatedItems = true; } },
  });

  await assert.rejects(
    updateEstadoPedido({ params: { id: 'order-1' }, body: { estado: 'LISTO' }, restauranteId: 'restaurant-1', user: { rol: 'COCINERO', userId: 'user-1' } }, {}),
    (error) => error.status === 409,
  );
  assert.equal(updatedItems, false);
});

test('официант не меняет статус кухни, а готовность фиксирует сотрудника кухни', async (t) => {
  const oldFind = prisma.pedido.findFirst;
  const oldTransaction = prisma.$transaction;
  t.after(() => { prisma.pedido.findFirst = oldFind; prisma.$transaction = oldTransaction; });
  const before = new Date('2026-10-25T08:00:00Z');
  prisma.pedido.findFirst = async () => ({ id: 'order-2', estado: 'EN_COCINA', tipo: 'EN_MESA', actualizadoEn: before });
  await assert.rejects(
    updateEstadoPedido({ params: { id: 'order-2' }, body: { estado: 'LISTO' }, restauranteId: 'rest-1', user: { rol: 'MESERO', userId: 'waiter-1' } }, {}),
    (error) => error.status === 403,
  );
  let worker;
  prisma.$transaction = async (work) => work({
    pedido: {
      updateMany: async ({ where }) => { assert.equal(where.estado, 'EN_COCINA'); return { count: 1 }; },
      update: async ({ data }) => { worker = data; },
      findUniqueOrThrow: async () => ({ id: 'order-2', estado: 'LISTO', ...worker }),
    },
    usuario: { findFirst: async () => ({ nombre: 'Повар Алия' }) },
    itemPedido: { updateMany: async () => ({ count: 1 }) },
  });
  let response;
  await updateEstadoPedido(
    { params: { id: 'order-2' }, body: { estado: 'LISTO' }, restauranteId: 'rest-1', user: { rol: 'COCINERO', userId: 'cook-1' } },
    { json: (body) => { response = body; } },
  );
  assert.deepEqual(worker, { cocineroId: 'cook-1', cocineroNombre: 'Повар Алия' });
  assert.equal(response.cocineroNombre, 'Повар Алия');
});

test('отчёт кухни группирует по готовившему сотруднику, а не по оформителю', async (t) => {
  const oldRaw = prisma.$queryRaw;
  t.after(() => { prisma.$queryRaw = oldRaw; });
  prisma.$queryRaw = async (query) => {
    const sql = query.strings.join('');
    assert.match(sql, /p\."cocineroId"/);
    assert.doesNotMatch(sql, /meseroId/);
    return [{ nombre: 'Повар Алия', pedidos: 2, promedio: 11.4 }];
  };
  let result;
  await getProductividad({ restauranteId: 'report-kitchen-test' }, { json: (body) => { result = body; } });
  assert.deepEqual(result, [{ nombre: 'Повар Алия', pedidos: 2, tiempoPromedio: 11 }]);
});

test('оплата сохраняет именно принявшего деньги сотрудника и чек печатает его роль', async (t) => {
  const oldTransaction = prisma.$transaction;
  const oldPrint = printService.imprimir;
  t.after(() => { prisma.$transaction = oldTransaction; printService.imprimir = oldPrint; });
  let saved;
  prisma.$transaction = async (work) => work({
    usuario: { findFirst: async ({ where }) => {
      assert.equal(where.id, 'cashier-1');
      return { nombre: 'Алия', rol: 'CAJERO' };
    } },
    pedido: {
      updateMany: async ({ where, data }) => { assert.equal(where.estado, 'ENTREGADO'); saved = data; return { count: 1 }; },
      findUniqueOrThrow: async () => ({ id: 'order-1', numero: 15, ...saved, mesaId: null }),
    },
  });
  printService.imprimir = async () => ({ resultados: [] });
  let response;
  await registrarPago(
    { params: { id: 'order-1' }, body: { metodoPago: 'Efectivo' }, restauranteId: 'rest-1', user: { userId: 'cashier-1' } },
    { json: (body) => { response = body; } },
  );
  assert.equal(saved.cajeroNombre, 'Алия');
  assert.equal(saved.cajeroRol, 'CAJERO');
  assert.equal(response.cajeroNombre, 'Алия');

  const p = {
    numero: 15, tipo: 'PARA_LLEVAR', estado: 'PAGADO', metodoPago: 'Efectivo', total: 3200,
    creadoEn: new Date('2026-10-25T00:00:00Z'), mesero: { nombre: 'Создатель заказа' },
    cajeroNombre: 'Алия', cajeroRol: 'CAJERO',
    items: [{ cantidad: 1, precio: 3200, subtotal: 3200, producto: { nombre: 'Бизнес-ланч', requiereCocina: true } }],
  };
  const printed = iconv.decode(receiptDoc({ nombre: 'Aisultan' }, p, { cols: 48, cp: 'cp866', lang: 'ru', cut: false, drawer: false }, 'recibo'), 'cp866');
  assert.match(printed, /Кассир: Алия/);
  assert.match(printed, /Наименование/);
  assert.match(printed, /Автоматизировано с помощью Innova365/);
  assert.doesNotMatch(printed, /Официант|Создатель заказа/);
});

test('кассовый отчёт считает оплаты, сотрудников, подразделения и клиентов из одних заказов', async (t) => {
  const old = {
    groupBy: prisma.pedido.groupBy, aggregate: prisma.pedido.aggregate, count: prisma.pedido.count,
    itemGroupBy: prisma.itemPedido.groupBy, itemAggregate: prisma.itemPedido.aggregate,
    findMany: prisma.usuario.findMany, products: prisma.producto.findMany, raw: prisma.$queryRaw,
    transaction: prisma.$transaction,
  };
  t.after(() => {
    prisma.pedido.groupBy = old.groupBy; prisma.pedido.aggregate = old.aggregate; prisma.pedido.count = old.count;
    prisma.itemPedido.groupBy = old.itemGroupBy; prisma.itemPedido.aggregate = old.itemAggregate;
    prisma.usuario.findMany = old.findMany; prisma.producto.findMany = old.products; prisma.$queryRaw = old.raw;
    prisma.$transaction = old.transaction;
  });
  prisma.$transaction = async (work, options) => {
    assert.equal(options.isolationLevel, 'RepeatableRead');
    return work(prisma);
  };
  prisma.pedido.groupBy = async ({ where }) => {
    assert.equal(where.estado, 'PAGADO');
    assert.ok(where.actualizadoEn.gte instanceof Date);
    return [
      { metodoPago: 'Efectivo', meseroId: 'u1', tipo: 'EN_MESA', _sum: { total: 1500 }, _count: { _all: 2 } },
      { metodoPago: 'QR', meseroId: null, tipo: 'PARA_LLEVAR', _sum: { total: 700 }, _count: { _all: 1 } },
    ];
  };
  prisma.pedido.aggregate = async () => ({ _count: { _all: 1 }, _sum: { total: 300 } });
  prisma.pedido.count = async ({ where }) => where.estado ? 1 : 4;
  prisma.itemPedido.groupBy = async () => [{ productoId: 'p1', _sum: { cantidad: 7, subtotal: 2200 } }];
  let itemAggregates = 0;
  prisma.itemPedido.aggregate = async () => ({ _sum: { cantidad: ++itemAggregates === 1 ? 10 : 2 } });
  prisma.usuario.findMany = async () => [{ id: 'u1', nombre: 'Асия' }];
  prisma.producto.findMany = async () => [{ id: 'p1', categoria: { id: 'cat1', nombre: 'Напитки' } }];
  let rawCalls = 0;
  prisma.$queryRaw = async () => ++rawCalls === 1 ? [{ available: true }] : [{ categoria_id: 'cat1', name: 'fastfood' }];
  const report = await loadCashReport('rest-1', 'hoy');
  assert.equal(report.paid, 3);
  assert.equal(report.revenue, 2200);
  assert.equal(report.average, 733.33);
  assert.deepEqual(report.methods.map((r) => [r.name, r.count, r.total]), [['Efectivo', 2, 1500], ['QR', 1, 700]]);
  assert.deepEqual(report.staff.map((r) => r.name), ['Асия', 'Не указан']);
  assert.deepEqual(report.service.map((r) => r.name), ['Стол', 'С собой']);
  assert.deepEqual(report.categories, [{ name: 'Напитки', count: 7, total: 2200 }]);
  assert.equal(report.orderedPositions, 10);
  assert.equal(report.cancelledPositions, 2);
  assert.deepEqual(report.departments, [{ name: 'fastfood', count: 7, total: 2200 }]);
  assert.deepEqual(report.clients, [{ name: 'Частное лицо', bills: 3, positions: 7, total: 2200 }]);
  const reportBytes = closingDoc({ nombre: 'Касса', moneda: 'KZT' }, report, { cols: 32, cp: 'cp866', lang: 'ru', cut: false, drawer: false });
  const text = iconv.decode(reportBytes, 'cp866');
  assert.match(text, /ОТЧЁТ ПО ВИДАМ ОПЛАТ/);
  assert.match(text, /ОТЧЁТ ПО СОТРУДНИКАМ/);
  assert.match(text, /ОТЧЁТ ПО ПОДРАЗДЕЛЕНИЯМ/);
  assert.match(text, /ПО ТИПУ ОБСЛУЖИВАНИЯ/);
  assert.match(text, /ОТЧЁТ ПО КЛИЕНТАМ/);
  assert.match(text, /Безналичные/);
  assert.match(text, /2200/);
  assert.doesNotMatch(text, /KZT/);
  assert.ok(reportBytes.includes(Buffer.from([0x1b, 0x2a, 0, 9, 0])));
});
