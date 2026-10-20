import { EscPos, Codepage, wrap } from './escpos';
import { moneyCode } from '../currency';

type Lang = 'ru' | 'en';

const L = {
  ru: {
    receipt: 'ЧЕК', bill: 'СЧЁТ', billNote: 'Предварительный счёт. Не является чеком оплаты.', order: 'Заказ', table: 'Стол', takeaway: 'С собой',
    waiter: 'Официант', date: 'Дата', total: 'ИТОГО', toPay: 'К ОПЛАТЕ', payment: 'Оплата', thanks: 'Спасибо за визит!',
    kitchen: 'КУХНЯ', newOrder: 'НОВЫЙ ЗАКАЗ', add: 'ДОБАВЛЕНО', closing: 'ИТОГИ ДНЯ', paidOrders: 'Оплачено заказов', revenue: 'Выручка',
    byMethod: 'По способам оплаты', open: 'Открытых заказов', avg: 'Средний чек', test: 'ТЕСТ ПЕЧАТИ', testOk: 'Принтер работает', sample: 'Кириллица: АБВГД абвгд ёЁ №',
    width: 'Ширина', cp: 'Кодировка', cash: 'Наличные', colName: 'Наименование', colQty: 'Кол', colPrice: 'Цена', colSum: 'Сумма',
  },
  en: {
    receipt: 'RECEIPT', bill: 'BILL', billNote: 'Pre-bill. Not a payment receipt.', order: 'Order', table: 'Table', takeaway: 'Takeaway',
    waiter: 'Waiter', date: 'Date', total: 'TOTAL', toPay: 'AMOUNT DUE', payment: 'Payment', thanks: 'Thank you!',
    kitchen: 'KITCHEN', newOrder: 'NEW ORDER', add: 'ADDED', closing: 'DAILY SUMMARY', paidOrders: 'Paid orders', revenue: 'Revenue',
    byMethod: 'By payment method', open: 'Open orders', avg: 'Average check', test: 'PRINT TEST', testOk: 'Printer works', sample: 'Cyrillic: АБВГД абвгд ёЁ №',
    width: 'Width', cp: 'Codepage', cash: 'Cash', colName: 'Item', colQty: 'Qty', colPrice: 'Price', colSum: 'Total',
  },
};

export interface Restaurante { nombre: string; direccion?: string | null; telefono?: string | null; pieTicket?: string | null; qrTicket?: string | null; moneda?: string | null }
export interface PedidoPrint {
  numero: number; tipo: 'EN_MESA' | 'PARA_LLEVAR'; estado: string; metodoPago: string | null; total: number | null; creadoEn: Date;
  mesa?: { numero: number } | null; mesero?: { nombre: string } | null;
  items: { id?: string; cantidad: number; precio: number; subtotal: number; servido?: boolean; producto: { nombre: string; requiereCocina: boolean } }[];
}

const money = (n: number) => n.toFixed(2);

const PAY: Record<string, { ru: string; en: string }> = {
  Efectivo: { ru: 'Наличные', en: 'Cash' }, Tarjeta: { ru: 'Карта', en: 'Card' }, QR: { ru: 'QR-код', en: 'QR code' },
  'Yape / Plin': { ru: 'QR-код', en: 'QR code' }, 'Yape/Plin': { ru: 'QR-код', en: 'QR code' }, Transferencia: { ru: 'Перевод', en: 'Transfer' },
};
const payLabel = (m: string, lang: Lang) => PAY[m]?.[lang] ?? m;
const fmtDate = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const where = (p: PedidoPrint, lang: Lang) => (p.mesa ? `${L[lang].table} ${p.mesa.numero}` : L[lang].takeaway);

/** Подставляет данные заказа в шаблон QR. Без шаблона — компактная строка с данными чека. */
export function qrText(tpl: string | null | undefined, r: Restaurante, p: PedidoPrint, id?: string): string {
  const total = money(Number(p.total ?? p.items.reduce((s, i) => s + Number(i.subtotal), 0)));
  const fecha = fmtDate(p.creadoEn).replace(' ', 'T');
  const t = tpl && tpl.trim() ? tpl : '{restaurante} | N{numero} | {fecha} | {total} {moneda}';
  return t.replace(/\{numero\}/g, String(p.numero)).replace(/\{total\}/g, total).replace(/\{fecha\}/g, fecha)
    .replace(/\{moneda\}/g, r.moneda ?? '').replace(/\{id\}/g, id ?? '').replace(/\{restaurante\}/g, r.nombre);
}

function header(e: EscPos, r: Restaurante) {
  e.align('center').bold(true).size(2, 2).line(r.nombre).size(1, 1).bold(false);
  if (r.direccion) e.line(r.direccion);
  if (r.telefono) e.line(r.telefono);
  e.align('left');
}

interface Opts { cols: number; cp: Codepage; lang: Lang; cut: boolean; drawer: boolean }

function finish(e: EscPos, o: Opts, drawer = false) {
  if (drawer && o.drawer) e.drawer();
  if (o.cut) e.cut(); else e.feed(5);
  return e.build();
}

/**
 * Таблица позиций. 48+ колонок: «Наименование | Кол | Цена | Сумма» в одну строку (название переносится).
 * Узкая лента (32): название отдельной строкой, ниже «кол x цена ..... сумма».
 */
function itemsTable(e: EscPos, p: PedidoPrint, o: Opts) {
  const t = L[o.lang];
  const cols = o.cols;
  if (cols >= 44) {
    const qtyW = 4, priceW = 9, sumW = 10;
    const nameW = cols - qtyW - priceW - sumW - 3;
    const col = (s: string, w: number, right = false) => (right ? s.padStart(w) : s.padEnd(w)).slice(0, w);
    const head = `${col(t.colName, nameW)} ${col(t.colQty, qtyW, true)} ${col(t.colPrice, priceW, true)} ${col(t.colSum, sumW, true)}`;
    e.bold(true).line(head).bold(false).rule('-');
    for (const it of p.items) {
      const lines = wrap(it.producto.nombre, nameW);
      lines.forEach((l, i) => {
        if (i === 0) e.line(`${col(l, nameW)} ${col(String(it.cantidad), qtyW, true)} ${col(money(Number(it.precio)), priceW, true)} ${col(money(Number(it.subtotal)), sumW, true)}`);
        else e.line(l);
      });
    }
  } else {
    e.rule('-');
    for (const it of p.items) {
      wrap(it.producto.nombre, cols).forEach((l) => e.line(l));
      e.between(`  ${it.cantidad} x ${money(Number(it.precio))}`, money(Number(it.subtotal)));
    }
  }
  e.rule('-');
}

export function receiptDoc(r: Restaurante, p: PedidoPrint, o: Opts, kind: 'recibo' | 'cuenta', id?: string): Buffer {
  const t = L[o.lang];
  const e = new EscPos(o.cols, o.cp);
  header(e, r);
  e.rule('=');
  e.align('center').bold(true).line(`${kind === 'recibo' ? t.receipt : t.bill} N${p.numero}`).bold(false).align('left');
  e.between(t.date, fmtDate(p.creadoEn));
  e.between(where(p, o.lang), p.mesero ? `${t.waiter}: ${p.mesero.nombre}` : '');
  itemsTable(e, p, o);
  const total = Number(p.total ?? p.items.reduce((s, i) => s + Number(i.subtotal), 0));
  e.bold(true).size(1, 2).between(kind === 'recibo' ? t.total : t.toPay, moneyCode(total, r.moneda)).size(1, 1).bold(false);
  if (kind === 'recibo' && p.metodoPago) e.between(t.payment, payLabel(p.metodoPago, o.lang));
  e.rule('=');
  e.align('center');
  if (kind === 'cuenta') e.line(t.billNote);
  else {
    e.line(r.pieTicket || t.thanks);
    // QR-код под таблицей (по центру)
    e.feed(1).qr(qrText(r.qrTicket, r, p, id), o.cols <= 32 ? 5 : 6).feed(1);
  }
  e.align('left');
  return finish(e, o, kind === 'recibo');
}

export function kitchenDoc(p: PedidoPrint, o: Opts, itemIds?: string[]): Buffer {
  const onlyNew = !!itemIds?.length;
  const t = L[o.lang];
  const e = new EscPos(o.cols, o.cp);
  e.align('center').bold(true).size(2, 2).line(t.kitchen).size(1, 1).line(onlyNew ? t.add : t.newOrder).bold(false).align('left');
  e.rule('=');
  e.bold(true).size(2, 2).line(where(p, o.lang)).size(1, 1).bold(false);
  e.between(`${t.order} N${p.numero}`, fmtDate(p.creadoEn).slice(11));
  if (p.mesero) e.line(`${t.waiter}: ${p.mesero.nombre}`);
  e.rule();
  const items = p.items.filter((i) => i.producto.requiereCocina && (!onlyNew || (!!i.id && itemIds!.includes(i.id))));
  for (const it of items) {
    e.bold(true).size(2, 2);
    wrap(`${it.cantidad} x ${it.producto.nombre}`, Math.floor(o.cols / 2)).forEach((l) => e.line(l));
    e.size(1, 1).bold(false);
  }
  e.rule('=');
  return finish(e, o);
}

export interface Cierre { fecha: Date; pagados: number; ingresos: number; abiertos: number; porMetodo: { metodo: string; total: number; n: number }[] }

export function closingDoc(r: Restaurante, c: Cierre, o: Opts): Buffer {
  const t = L[o.lang];
  const e = new EscPos(o.cols, o.cp);
  header(e, r);
  e.rule('=');
  e.align('center').bold(true).size(1, 2).line(t.closing).size(1, 1).bold(false).line(fmtDate(c.fecha)).align('left');
  e.rule();
  e.between(t.paidOrders, String(c.pagados));
  e.bold(true).between(t.revenue, moneyCode(c.ingresos, r.moneda)).bold(false);
  e.between(t.avg, moneyCode(c.pagados ? c.ingresos / c.pagados : 0, r.moneda));
  e.between(t.open, String(c.abiertos));
  e.rule();
  e.line(t.byMethod);
  for (const m of c.porMetodo) e.between(`${payLabel(m.metodo, o.lang)} (${m.n})`, moneyCode(m.total, r.moneda));
  e.rule('=');
  return finish(e, o);
}

export function testDoc(nombre: string, ancho: number, cp: string, o: Opts): Buffer {
  const t = L[o.lang];
  const e = new EscPos(o.cols, o.cp);
  e.align('center').bold(true).size(2, 2).line(t.test).size(1, 1).bold(false).align('left');
  e.rule('=');
  e.line(nombre);
  e.line(`${t.width}: ${ancho} mm (${o.cols})`);
  e.line(`${t.cp}: ${cp}`);
  e.line(t.sample);
  e.line('0123456789  12.50  x');
  e.line('1234567890'.repeat(6).slice(0, o.cols));
  e.align('center').qr('Innova365 test', 5).feed(1).align('left');
  e.rule('=');
  e.align('center').line(t.testOk).align('left');
  return finish(e, o, true);
}
