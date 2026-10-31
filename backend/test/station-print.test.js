const test = require('node:test');
const assert = require('node:assert/strict');
const iconv = require('iconv-lite');
const { kitchenDoc } = require('../dist/print/templates');

const pedido = {
  numero: 7, tipo: 'PARA_LLEVAR', estado: 'EN_COCINA', metodoPago: null, total: 3540, creadoEn: new Date('2026-10-31T12:00:00Z'), mesa: null, mesero: { nombre: 'Айгуль' },
  items: [
    { id: 'a', cantidad: 1, precio: 1450, subtotal: 1450, producto: { nombre: 'Бургер куриный', requiereCocina: true } },
    { id: 'b', cantidad: 2, precio: 500, subtotal: 1000, producto: { nombre: 'Айран', requiereCocina: false } },
  ],
};
const opts = { cols: 48, cp: 'cp866', lang: 'ru', cut: true, drawer: false };
const text = (buf) => iconv.decode(buf, 'cp866');

test('тикет станции печатает только свои позиции, даже если у товара нет requiereCocina (бар)', () => {
  const bar = text(kitchenDoc(pedido, opts, ['b'], { title: 'bar' }));
  assert.match(bar, /BAR/);
  assert.match(bar, /Айран/);
  assert.doesNotMatch(bar, /Бургер/);
});

test('тикет станции — таблица: заголовок колонок, номер, название и количество в одной строке', () => {
  const bar = text(kitchenDoc(pedido, opts, ['b'], { title: 'bar' }));
  assert.match(bar, /N\| Позиция\s+\| Кол/);
  assert.match(bar, /1\| Айран\s+\|\s+2/);
  assert.match(bar, /Итого позиций: 1/);
});

test('тикет станции кухни не содержит позиций других станций', () => {
  const kuhnya = text(kitchenDoc(pedido, opts, ['a'], { title: 'kuhnya' }));
  assert.match(kuhnya, /KUHNYA/);
  assert.match(kuhnya, /Бургер/);
  assert.doesNotMatch(kuhnya, /Айран/);
});

test('обычный тикет кухни без станции работает как раньше: только requiereCocina', () => {
  const kitchen = text(kitchenDoc(pedido, opts));
  assert.match(kitchen, /Бургер/);
  assert.doesNotMatch(kitchen, /Айран/);
});
