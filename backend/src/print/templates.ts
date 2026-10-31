import { EscPos, Codepage, wrap } from './escpos';
import { CURRENCIES, DEFAULT_CURRENCY, isCurrency, moneyCode } from '../currency';
import type { CashReport } from './cash-report';
import { printSettings } from './settings';

type Lang = 'ru' | 'en';

const L = {
  ru: {
    receipt: 'ЧЕК', bill: 'СЧЁТ', billNote: 'Предварительный счёт. Не является чеком оплаты.', order: 'Заказ', table: 'Стол', takeaway: 'С собой',
    orderBy: 'Оформил', date: 'Дата', total: 'ИТОГО', toPay: 'К ОПЛАТЕ', payment: 'Оплата', thanks: 'Спасибо за визит!',
    kitchen: 'КУХНЯ', pos: 'Позиция', qty: 'Кол', itemsTotal: 'Итого позиций', newOrder: 'НОВЫЙ ЗАКАЗ', add: 'ДОБАВЛЕНО', closing: 'ИТОГОВЫЙ ОТЧЁТ', paidOrders: 'Оплачено заказов', revenue: 'Выручка',
    byMethod: 'По способам оплаты', open: 'Открытых заказов', avg: 'Средний чек', test: 'ТЕСТ ПЕЧАТИ', testOk: 'Принтер работает', sample: 'Кириллица: АБВГД абвгд ёЁ №',
    width: 'Ширина', cp: 'Кодировка', cash: 'Наличные', colName: 'Наименование', colQty: 'Кол-во', colPrice: 'Цена', colSum: 'Сумма', subtotal: 'Блюда', service: 'Обслуживание',
  },
  en: {
    receipt: 'RECEIPT', bill: 'BILL', billNote: 'Pre-bill. Not a payment receipt.', order: 'Order', table: 'Table', takeaway: 'Takeaway',
    orderBy: 'Created by', date: 'Date', total: 'TOTAL', toPay: 'AMOUNT DUE', payment: 'Payment', thanks: 'Thank you!',
    kitchen: 'KITCHEN', pos: 'Item', qty: 'Qty', itemsTotal: 'Total items', newOrder: 'NEW ORDER', add: 'ADDED', closing: 'DAILY SUMMARY', paidOrders: 'Paid orders', revenue: 'Revenue',
    byMethod: 'By payment method', open: 'Open orders', avg: 'Average check', test: 'PRINT TEST', testOk: 'Printer works', sample: 'Cyrillic: АБВГД абвгд ёЁ №',
    width: 'Width', cp: 'Codepage', cash: 'Cash', colName: 'Item', colQty: 'Qty', colPrice: 'Price', colSum: 'Total', subtotal: 'Items', service: 'Service',
  },
};

export interface Restaurante { nombre: string; direccion?: string | null; telefono?: string | null; pieTicket?: string | null; qrTicket?: string | null; moneda?: string | null; printSettings?: unknown }
export interface PedidoPrint {
  numero: number; tipo: 'EN_MESA' | 'PARA_LLEVAR'; estado: string; metodoPago: string | null; total: number | null; servicePercent?: number; serviceAmount?: number; pagadoEn?: Date | null; creadoEn: Date; actualizadoEn?: Date;
  mesa?: { numero: number } | null; mesero?: { nombre: string } | null;
  cajeroNombre?: string | null; cajeroRol?: string | null;
  items: { id?: string; cantidad: number; precio: number; subtotal: number; servido?: boolean; producto: { nombre: string; requiereCocina: boolean } }[];
}

const money = (n: number) => n.toFixed(2);

const PAY: Record<string, { ru: string; en: string }> = {
  Efectivo: { ru: 'Наличные', en: 'Cash' }, Tarjeta: { ru: 'Карта', en: 'Card' }, QR: { ru: 'Безналичные', en: 'Cashless' },
  'Yape / Plin': { ru: 'Безналичные', en: 'Cashless' }, 'Yape/Plin': { ru: 'Безналичные', en: 'Cashless' }, Transferencia: { ru: 'Перевод', en: 'Transfer' },
};
const payLabel = (m: string, lang: Lang) => PAY[m]?.[lang] ?? m;
const fmtDate = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const where = (p: PedidoPrint, lang: Lang) => (p.mesa ? `${L[lang].table} ${p.mesa.numero}` : L[lang].takeaway);
const cashierLabel = (rol: string | null | undefined, lang: Lang) => {
  const labels: Record<string, { ru: string; en: string }> = {
    CAJERO: { ru: 'Кассир', en: 'Cashier' },
    ADMIN: { ru: 'Администратор', en: 'Administrator' },
    SUPERADMIN: { ru: 'Владелец', en: 'Owner' },
  };
  return labels[rol ?? '']?.[lang] ?? (lang === 'ru' ? 'Сотрудник' : 'Staff');
};

/** Подставляет данные заказа в шаблон QR. Без шаблона — компактная строка с данными чека. */
export function qrText(tpl: string | null | undefined, r: Restaurante, p: PedidoPrint, id?: string): string {
  const total = money(Number(p.total ?? p.items.reduce((s, i) => s + Number(i.subtotal), 0)));
  const fecha = fmtDate(p.estado === 'PAGADO' ? (p.pagadoEn ?? p.actualizadoEn ?? p.creadoEn) : p.creadoEn).replace(' ', 'T');
  const t = tpl && tpl.trim() ? tpl : '{restaurante} | N{numero} | {fecha} | {total} {moneda}';
  return t.replace(/\{numero\}/g, String(p.numero)).replace(/\{total\}/g, total).replace(/\{fecha\}/g, fecha)
    .replace(/\{moneda\}/g, r.moneda ?? '').replace(/\{id\}/g, id ?? '').replace(/\{restaurante\}/g, r.nombre);
}

function header(e: EscPos, r: Restaurante, showAddress = false, showPhone = false) {
  e.align('center').bold(true).size(2, 2).line(r.nombre).size(1, 1).bold(false);
  if (showAddress && r.direccion) e.line(r.direccion);
  if (showPhone && r.telefono) e.line(r.telefono);
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
function itemsTable(e: EscPos, p: PedidoPrint, o: Opts, currency?: string | null) {
  const t = L[o.lang];
  const cols = o.cols;
  const decimals = currency && isCurrency(currency) ? CURRENCIES[currency] : CURRENCIES[DEFAULT_CURRENCY];
  const amount = (value: number) => value.toFixed(decimals);
  if (cols >= 44) {
    const qtyW = 6, priceW = 9, sumW = 10;
    const nameW = cols - qtyW - priceW - sumW - 3;
    const col = (s: string, w: number, right = false) => (right ? s.padStart(w) : s.padEnd(w)).slice(0, w);
    const head = `${col(t.colName, nameW)} ${col(t.colQty, qtyW, true)} ${col(t.colPrice, priceW, true)} ${col(t.colSum, sumW, true)}`;
    e.bold(true).line(head).bold(false).rule('-');
    for (const it of p.items) {
      const qty = String(it.cantidad), price = amount(Number(it.precio)), sum = amount(Number(it.subtotal));
      if (qty.length > qtyW || price.length > priceW || sum.length > sumW) {
        wrap(it.producto.nombre, cols).forEach((line) => e.line(line));
        e.between(`  ${qty} x ${price}`, sum);
        continue;
      }
      const lines = wrap(it.producto.nombre, nameW);
      lines.forEach((l, i) => {
        if (i === 0) e.line(`${col(l, nameW)} ${col(qty, qtyW, true)} ${col(price, priceW, true)} ${col(sum, sumW, true)}`);
        else e.line(l);
      });
    }
  } else {
    // XP-76 печатает 33 символа в строке: четыре короткие колонки без обрезки сумм.
    const nameW = cols - 21, qtyW = 6, priceW = 6, sumW = 6;
    const cell = (text: string, width: number, right = false) => right ? text.padStart(width) : text.padEnd(width);
    e.bold(true).line(`${cell(nameW >= 12 ? t.colName : 'Наимен.', nameW)} ${cell(t.colQty, qtyW, true)} ${cell(t.colPrice, priceW, true)} ${cell(t.colSum, sumW, true)}`).bold(false).rule('-');
    for (const it of p.items) {
      const qty = String(it.cantidad), price = amount(Number(it.precio)), sum = amount(Number(it.subtotal));
      if (qty.length > qtyW || price.length > priceW || sum.length > sumW) {
        wrap(it.producto.nombre, cols).forEach((line) => e.line(line));
        e.between(`  ${qty} x ${price}`, sum);
      } else {
        wrap(it.producto.nombre, nameW).forEach((line, index) => e.line(`${cell(line, nameW)} ${cell(index ? '' : qty, qtyW, true)} ${cell(index ? '' : price, priceW, true)} ${cell(index ? '' : sum, sumW, true)}`));
      }
    }
  }
  e.rule('-');
}

export function receiptDoc(r: Restaurante, p: PedidoPrint, o: Opts, kind: 'recibo' | 'cuenta', id?: string): Buffer {
  const t = L[o.lang];
  const settings = printSettings(r.printSettings).receipt;
  const e = new EscPos(o.cols, o.cp);
  header(e, r, settings.showAddress, settings.showPhone);
  e.rule('=');
  e.align('center').bold(true);
  wrap(`${kind === 'recibo' ? settings.title : t.bill} N${p.numero}`, o.cols).forEach((line) => e.line(line));
  e.bold(false).align('left');
  e.line(`${t.date}: ${fmtDate(kind === 'recibo' && p.estado === 'PAGADO' ? (p.pagadoEn ?? p.actualizadoEn ?? p.creadoEn) : p.creadoEn)}`);
  e.line(p.mesa ? `${t.table}: ${p.mesa.numero}` : `${t.order}: ${t.takeaway}`);
  if (kind === 'recibo' && settings.showCashier && p.cajeroNombre) e.line(`${cashierLabel(p.cajeroRol, o.lang)}: ${p.cajeroNombre}`);
  itemsTable(e, p, o, r.moneda);
  const total = Number(p.total ?? p.items.reduce((s, i) => s + Number(i.subtotal), 0));
  if (Number(p.servicePercent ?? 0) > 0) {
    e.between(t.subtotal, moneyCode(total - Number(p.serviceAmount ?? 0), r.moneda));
    e.between(`${t.service} ${Number(p.servicePercent)}%`, moneyCode(Number(p.serviceAmount ?? 0), r.moneda));
    e.rule('-');
  }
  e.bold(true).size(1, 2).between(kind === 'recibo' ? t.total : t.toPay, moneyCode(total, r.moneda)).size(1, 1).bold(false);
  if (kind === 'recibo' && p.metodoPago) e.between(t.payment, payLabel(p.metodoPago, o.lang));
  e.rule('=');
  e.align('center');
  if (kind === 'cuenta') e.line(t.billNote);
  else {
    if (settings.showQr) e.feed(1).qr(qrText(r.qrTicket, r, p, id), o.cols <= 33 ? 5 : 6).feed(1);
    e.line(r.pieTicket || t.thanks);
    if (settings.footer) wrap(settings.footer, o.cols).forEach((line) => e.line(line));
  }
  e.align('left');
  return finish(e, o, kind === 'recibo');
}

/** Таблица позиций тикета станции: « №| Позиция | Кол», длинные названия переносятся на следующие строки. */
function stationTable(e: EscPos, items: PedidoPrint['items'], cols: number, t: { pos: string; qty: string }) {
  const nameW = Math.max(8, cols - 10);
  const cell = (n: string, name: string, q: string) => `${n.padStart(2)}| ${name.padEnd(nameW)} | ${q.padStart(3)}`;
  e.bold(true).line(cell('№', t.pos, t.qty)).bold(false);
  e.line(`--+${'-'.repeat(nameW + 2)}+${'-'.repeat(4)}`);
  items.forEach((it, i) => {
    const parts = wrap(it.producto.nombre, nameW);
    e.bold(true).size(1, 2);
    parts.forEach((part, k) => e.line(cell(k === 0 ? String(i + 1) : '', part, k === 0 ? String(it.cantidad) : '')));
    e.size(1, 1).bold(false);
  });
}

/** station — тикет станции (кухня/бар/самса): заголовок = имя принтера, фильтр requiereCocina не применяется (бар печатает напитки). */
export function kitchenDoc(p: PedidoPrint, o: Opts, itemIds?: string[], station?: { title: string }): Buffer {
  const onlyNew = !!itemIds?.length && !station;
  const t = L[o.lang];
  const e = new EscPos(o.cols, o.cp);
  e.align('center').bold(true).size(2, 2).line(station ? station.title.toUpperCase() : t.kitchen).size(1, 1).line(onlyNew ? t.add : t.newOrder).bold(false).align('left');
  e.rule('=');
  e.bold(true).size(2, 2).line(where(p, o.lang)).size(1, 1).bold(false);
  e.between(`${t.order} N${p.numero}`, fmtDate(p.creadoEn).slice(11));
  if (p.mesero) e.line(`${t.orderBy}: ${p.mesero.nombre}`);
  e.rule();
  const items = p.items.filter((i) => (station ? !!i.id && !!itemIds?.includes(i.id) : i.producto.requiereCocina && (!onlyNew || (!!i.id && itemIds!.includes(i.id)))));
  if (station) {
    stationTable(e, items, o.cols, t);
    e.rule('=').line(`${t.itemsTotal}: ${items.length}`);
    return finish(e, o);
  }
  for (const it of items) {
    e.bold(true).size(2, 2);
    wrap(`${it.cantidad} x ${it.producto.nombre}`, Math.floor(o.cols / 2)).forEach((l) => e.line(l));
    e.size(1, 1).bold(false);
  }
  e.rule('=');
  return finish(e, o);
}

/** Таблица с 3–5 колонками. Ширины рассчитаны так, чтобы строка не выходила за 32 символа на 58 мм. */
function closingGrid(e: EscPos, title: string, headers: string[], rows: string[][], foot: string[], o: Opts) {
  const numericCount = headers.length - 3;
  const indexW = 2;
  const countWidths = Array.from({ length: numericCount }, (_, i) => Math.max(3, ...rows.map((r) => r[i + 2].length), foot[i + 2].length));
  const amountW = Math.max(9, ...rows.map((r) => r.at(-1)!.length), foot.at(-1)!.length);
  const nameW = o.cols - indexW - countWidths.reduce((sum, w) => sum + w, 0) - amountW - (headers.length - 1);
  const widths = [indexW, nameW, ...countWidths, amountW];
  const cell = (value: string, i: number) => i === 1 ? value.padEnd(widths[i]).slice(0, widths[i]) : value.padStart(widths[i]).slice(-widths[i]);
  const line = (values: string[]) => e.line(values.map(cell).join('|'));
  e.align('center').bold(true).line(title).bold(false).align('left');
  e.rule('-');
  line(headers);
  e.rule('-');
  if (!rows.length) e.line(o.lang === 'ru' ? 'Нет данных' : 'No data');
  for (const values of rows) {
    const parts = wrap(values[1], nameW);
    line([values[0], parts[0], ...values.slice(2)]);
    for (const part of parts.slice(1)) line(['', part, ...values.slice(2).map(() => '')]);
  }
  e.rule('-');
  line(foot);
  e.feed(1);
}

export function closingDoc(r: Restaurante, c: CashReport, o: Opts): Buffer {
  const t = L[o.lang];
  const e = new EscPos(o.cols, o.cp);
  const code = r.moneda && isCurrency(r.moneda) ? r.moneda : DEFAULT_CURRENCY;
  const decimals = Math.max(CURRENCIES[code],
    [c.revenue, c.cancelAmount, ...c.methods, ...c.staff, ...c.service, ...(c.departments ?? []), ...(c.clients ?? [])]
      .some((value) => !Number.isInteger(typeof value === 'number' ? value : value.total)) ? 2 : 0);
  const val = (value: number) => value.toFixed(decimals);
  const reportMoney = (value: number) => `${val(value)} ${code === 'KZT' ? '₸' : code}`;
  e.align('center').bold(true);
  wrap(printSettings(r.printSettings).report.title, o.cols).forEach((line) => e.line(line));
  e.bold(false).align('left');
  e.align('center').line(o.lang === 'ru' ? c.period === 'hoy' ? 'За сегодня' : c.period === 'semana' ? 'За 7 дней' : 'За месяц' : c.period === 'hoy' ? 'Today' : c.period === 'semana' ? 'Last 7 days' : 'This month').align('left');
  e.line(`${o.lang === 'ru' ? 'От' : 'From'}: ${c.from}`);
  e.line(`${o.lang === 'ru' ? 'До' : 'To'}: ${c.to}`);
  wrap(`${o.lang === 'ru' ? 'Торговая точка' : 'Outlet'}: ${r.nombre}`, o.cols).forEach((line) => e.line(line));
  e.line(`${o.lang === 'ru' ? 'Дата' : 'Printed'}: ${c.generatedAt}`);
  e.between(o.lang === 'ru' ? 'Всего счетов' : 'Total bills', String(c.created));
  e.between(o.lang === 'ru' ? 'Позиций заказов' : 'Order items', String(c.orderedPositions));
  e.between(o.lang === 'ru' ? 'Чеков с отказом' : 'Cancelled bills', String(c.cancelled));
  e.between(o.lang === 'ru' ? 'Позиций отказов' : 'Cancelled items', String(c.cancelledPositions));
  e.between(o.lang === 'ru' ? 'Сумма отказов' : 'Cancelled sum', reportMoney(c.cancelAmount));
  e.between(o.lang === 'ru' ? 'Гостей' : 'Guests', '-');
  e.between(o.lang === 'ru' ? 'Переносов' : 'Transfers', '-');
  e.between(o.lang === 'ru' ? 'Разблокировок' : 'Unlocks', '-');
  e.bold(true).between(t.revenue, reportMoney(c.revenue)).bold(false);
  const departments = c.departments ?? [];
  const clients = c.clients ?? [];
  closingGrid(e, o.lang === 'ru' ? 'ОТЧЁТ ПО ВИДАМ ОПЛАТ' : 'PAYMENT METHODS',
    o.lang === 'ru' ? ['N', 'Вид оплаты', 'Сумма'] : ['N', 'Method', 'Amount'],
    c.methods.map((row, i) => [String(i + 1), payLabel(row.name, o.lang), val(row.total)]), ['', o.lang === 'ru' ? 'Итого' : 'Total', val(c.revenue)], o);
  closingGrid(e, o.lang === 'ru' ? 'ОТЧЁТ ПО СОТРУДНИКАМ' : 'STAFF',
    o.lang === 'ru' ? ['N', 'Сотрудник', 'Кол', 'Сумма'] : ['N', 'Staff', 'Qty', 'Amount'],
    c.staff.map((row, i) => [String(i + 1), row.name, String(row.count), val(row.total)]), ['', o.lang === 'ru' ? 'Итого' : 'Total', String(c.paid), val(c.revenue)], o);
  closingGrid(e, o.lang === 'ru' ? 'ОТЧЁТ ПО ПОДРАЗДЕЛЕНИЯМ' : 'DEPARTMENTS',
    o.lang === 'ru' ? ['N', 'Подразд.', 'Кол', 'Сумма'] : ['N', 'Outlet', 'Qty', 'Amount'],
    departments.map((row, i) => [String(i + 1), row.name, String(row.count), val(row.total)]),
    ['', o.lang === 'ru' ? 'Итого' : 'Total', String(departments.reduce((sum, row) => sum + row.count, 0)), val(departments.reduce((sum, row) => sum + row.total, 0))], o);
  closingGrid(e, o.lang === 'ru' ? 'ПО ТИПУ ОБСЛУЖИВАНИЯ' : 'SERVICE TYPE',
    o.lang === 'ru' ? ['N', 'Тип', 'Кол', 'Сумма'] : ['N', 'Type', 'Qty', 'Amount'],
    c.service.map((row, i) => [String(i + 1), row.name, String(row.count), val(row.total)]),
    ['', o.lang === 'ru' ? 'Итого' : 'Total', String(c.paid), val(c.revenue)], o);
  closingGrid(e, o.lang === 'ru' ? 'ОТЧЁТ ПО КЛИЕНТАМ' : 'CLIENTS',
    o.lang === 'ru' ? ['N', 'Клиент', 'Сч', 'Поз', 'Сумма'] : ['N', 'Client', 'Bills', 'Qty', 'Amount'],
    clients.map((row, i) => [String(i + 1), row.name, String(row.bills), String(row.positions), val(row.total)]),
    ['', o.lang === 'ru' ? 'Итого' : 'Total', String(c.paid), String(c.positions), val(c.revenue)], o);
  e.align('center').line(code === 'KZT' ? '₸' : code).align('left');
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
