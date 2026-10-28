import { esc, fmtDateTime, fmtMoney, fmtQty } from './print';
import { printHtml } from './printPanel';
import { t, locale, printLang } from '../i18n';
import { currencyCode, currencySymbol, getCurrency } from './currency';
import { payLabel } from './payments';
import { printSettings, type PrintSettings } from './printSettings';
import type { Compra, Insumo, Movimiento, Pedido } from '../types';
import type { CashReport } from '../types/cashReport';

export interface RestauranteInfo { nombre: string; direccion?: string | null; telefono?: string | null; pieTicket?: string | null; qrTicket?: string | null; printSettings?: PrintSettings | null }

function head(r: RestauranteInfo | undefined, title: string, sub?: string): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px">
      <div>
        <h1>${esc(title)}</h1>
        ${sub ? `<div class="muted">${esc(sub)}</div>` : ''}
      </div>
      <div class="right">
        <div class="bold">${esc(r?.nombre ?? 'Innova365')}</div>
        ${r?.direccion ? `<div class="muted">${esc(r.direccion)}</div>` : ''}
        ${r?.telefono ? `<div class="muted">${esc(r.telefono)}</div>` : ''}
        <div class="muted">${esc(fmtDateTime(Date.now()))}</div>
      </div>
    </div>`;
}

/** Заказ поставщику (A4) */
export function printCompra(c: Compra, r?: RestauranteInfo) {
  const rows = c.items.map((i, n) => `
    <tr><td>${n + 1}</td><td>${esc(i.nombre)}</td><td class="right">${fmtQty(i.cantidad)} ${esc(i.unidad)}</td>
    <td class="right">${fmtMoney(i.costoUnitario)}</td><td class="right">${fmtMoney(i.cantidad * i.costoUnitario)}</td>
    <td class="right">${fmtQty(i.cantidadRecibida)}</td></tr>`).join('');
  const html = `${head(r, `${t('Compra')} №${c.numero}`, `${t('Proveedor')}: ${c.proveedor.nombre}${c.proveedor.telefono ? ' · ' + c.proveedor.telefono : ''}`)}
    <table><thead><tr><th>#</th><th>${esc(t('Insumo'))}</th><th class="right">${esc(t('Cantidad'))}</th><th class="right">${esc(t('Precio'))}</th><th class="right">${esc(t('Suma'))}</th><th class="right">${esc(t('Recibido'))}</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" class="right bold">${esc(t('TOTAL'))}</td><td class="right bold">${fmtMoney(c.total)}</td><td></td></tr></tfoot></table>
    ${c.fechaEsperada ? `<p>${esc(t('Entrega esperada'))}: ${esc(fmtDateTime(c.fechaEsperada))}</p>` : ''}
    ${c.notas ? `<p class="muted">${esc(c.notas)}</p>` : ''}
    <div class="sign"><div>${esc(t('Pidió'))}</div><div>${esc(t('Recibió'))}</div><div>${esc(t('Proveedor'))}</div></div>`;
  return printHtml(html, { title: `${t('Compra')} ${c.numero}`, paper: 'A4' });
}

/** Лист ревизии (A4): пустая колонка для ручного пересчёта */
export function printRevisionSheet(insumos: Insumo[], r?: RestauranteInfo) {
  const rows = insumos.map((i, n) => `
    <tr><td>${n + 1}</td><td>${esc(i.nombre)}</td><td>${esc(i.categoria ?? '')}</td>
    <td class="right">${fmtQty(Number(i.stockActual))} ${esc(i.unidad)}</td><td><span class="box"></span></td><td><span class="box"></span></td></tr>`).join('');
  const html = `${head(r, t('Hoja de revisión (conteo de inventario)'), t('Cuenta el stock real y anota la cantidad'))}
    <table><thead><tr><th>#</th><th>${esc(t('Insumo'))}</th><th>${esc(t('Categoría'))}</th><th class="right">${esc(t('En el sistema'))}</th><th>${esc(t('Contado'))}</th><th>${esc(t('Diferencia'))}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="sign"><div>${esc(t('Contó'))}</div><div>${esc(t('Verificó'))}</div><div>${esc(t('Aprobó'))}</div></div>`;
  return printHtml(html, { title: t('Hoja de revisión (conteo de inventario)'), paper: 'A4' });
}

/** Остатки на складе (A4) */
export function printStock(insumos: Insumo[], r?: RestauranteInfo) {
  const rows = insumos.map((i, n) => `
    <tr><td>${n + 1}</td><td>${esc(i.nombre)}</td><td>${esc(i.categoria ?? '')}</td>
    <td class="right bold">${fmtQty(Number(i.stockActual))} ${esc(i.unidad)}</td><td class="right">${fmtQty(Number(i.stockMinimo))}</td><td>${esc(i.estado === 'OK' ? '' : t(i.estado === 'CRITICO' ? 'Crítico' : 'Bajo'))}</td></tr>`).join('');
  const html = `${head(r, t('Stock en almacén'))}
    <table><thead><tr><th>#</th><th>${esc(t('Insumo'))}</th><th>${esc(t('Categoría'))}</th><th class="right">${esc(t('Stock Actual'))}</th><th class="right">${esc(t('Stock Mínimo'))}</th><th>${esc(t('Estado'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
  return printHtml(html, { title: t('Stock en almacén'), paper: 'A4' });
}

/** Журнал движений (A4) */
export function printMovimientos(movs: Movimiento[], r?: RestauranteInfo) {
  const rows = movs.map((m) => `
    <tr><td>${esc(fmtDateTime(m.creadoEn))}</td><td>${esc(m.insumo)}</td><td>${esc(tipoLabel(m.tipo))}</td>
    <td class="right bold">${m.cantidad > 0 ? '+' : ''}${fmtQty(m.cantidad)} ${esc(m.unidad)}</td><td class="right">${fmtQty(m.saldo)}</td><td>${esc(m.usuario ?? '')}</td><td>${esc(m.motivo ?? '')}</td></tr>`).join('');
  const html = `${head(r, t('Registro de movimientos'))}
    <table><thead><tr><th>${esc(t('Fecha'))}</th><th>${esc(t('Insumo'))}</th><th>${esc(t('Tipo'))}</th><th class="right">${esc(t('Cantidad'))}</th><th class="right">${esc(t('Saldo'))}</th><th>${esc(t('Usuario'))}</th><th>${esc(t('Motivo'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
  return printHtml(html, { title: t('Registro de movimientos'), paper: 'A4' });
}

export function tipoLabel(tipo: string): string {
  switch (tipo) {
    case 'INICIAL': return t('Saldo inicial');
    case 'COMPRA': return t('Compra');
    case 'AJUSTE': return t('Ajuste');
    case 'MERMA': return t('Merma');
    case 'REVISION': return t('Revisión');
    case 'CONSUMO': return t('Consumo');
    case 'DEVOLUCION': return t('Devolución al almacén');
    default: return tipo;
  }
}

// ───────── Чек / счёт через браузер (запасной вариант без чекового принтера) ─────────

/** Подставляет данные заказа в шаблон QR ({numero} {total} {fecha} {id} {restaurante}); без шаблона — строка с данными чека. */
export function qrText(tpl: string | null | undefined, r: RestauranteInfo | undefined, p: Pedido): string {
  const total = Number(p.total ?? p.items.reduce((s, i) => s + Number(i.subtotal), 0)).toFixed(2);
  const d = new Date(p.estado === 'PAGADO' ? (p.pagadoEn || p.actualizadoEn || p.creadoEn) : p.creadoEn);
  const pad = (x: number) => String(x).padStart(2, '0');
  const fecha = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const base = tpl && tpl.trim() ? tpl : '{restaurante} | N{numero} | {fecha} | {total} {moneda}';
  return base.replace(/\{numero\}/g, String(p.numero)).replace(/\{total\}/g, total).replace(/\{fecha\}/g, fecha)
    .replace(/\{moneda\}/g, currencyCode()).replace(/\{id\}/g, p.id).replace(/\{restaurante\}/g, r?.nombre ?? 'Innova365');
}

/**
 * Чек через окно печати браузера (когда нет кассового принтера или он недоступен).
 * Рулонная лента нужной ширины (`ancho`, мм), таблица позиций и QR-код.
 */
export async function receiptHtml(p: Pedido, r: RestauranteInfo | undefined, kind: 'recibo' | 'cuenta'): Promise<string> {
  const total = Number(p.total ?? p.items.reduce((s, i) => s + Number(i.subtotal), 0));
  const settings = printSettings(r?.printSettings).receipt;
  const receiptDate = kind === 'recibo' && p.estado === 'PAGADO' ? (p.pagadoEn || p.actualizadoEn || p.creadoEn) : p.creadoEn;
  const number = (value: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: getCurrency().decimals, maximumFractionDigits: getCurrency().decimals }).format(value);
  const cashierRole = printLang === 'en'
    ? ({ CAJERO: 'Cashier', ADMIN: 'Administrator', SUPERADMIN: 'Owner' } as Record<string, string>)[p.cajeroRol ?? ''] ?? 'Staff'
    : ({ CAJERO: 'Кассир', ADMIN: 'Администратор', SUPERADMIN: 'Владелец' } as Record<string, string>)[p.cajeroRol ?? ''] ?? 'Сотрудник';
  // узкая лента (≤ 65 мм) прячет колонку «Цена» — это решает CSS по ширине страницы, поэтому ширину можно менять в окне печати
  const rows = p.items.map((i) => `
    <tr><td>${esc(i.producto.nombre)}</td><td class="right">${i.cantidad}</td><td class="right col-price">${number(Number(i.precio))}</td><td class="right bold">${number(Number(i.subtotal))}</td></tr>`).join('');

  let qrSvg = '';
  if (kind === 'recibo' && settings.showQr) {
    try {
      const QR = await import('qrcode');
      qrSvg = await QR.toString(qrText(r?.qrTicket, r, p), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    } catch { /* без QR печатаем чек как есть */ }
  }

  const ruleCss = 'border:0;border-top:1px dashed #000;margin:6px 0';
  const html = `
    <style>
      .rc td,.rc th{padding:3px 2px;border:0;border-bottom:1px solid #999;font-size:12px}
      .rc th{border-bottom:1.5px solid #000;font-size:10px;white-space:nowrap;letter-spacing:0;text-transform:none}
      .rc{width:100%;table-layout:fixed;border:1px solid #000;border-collapse:collapse}
      .rc th:nth-child(1){width:39%}.rc th:nth-child(2){width:14%}.rc th:nth-child(3){width:22%}.rc th:nth-child(4){width:25%}
      .rc td:not(:first-child){white-space:nowrap}
      .rc td,.rc th{border-left:1px solid #000;border-right:1px solid #000}
      .receipt-meta{font-size:11px;line-height:1.4;margin:5px 0}
      .qr{width:36mm;margin:8px auto 2px} .qr svg{display:block;width:100%;height:auto}
      @media (max-width:65mm){.col-price{display:none}.qr{width:30mm}.rc th:nth-child(1){width:50%}.rc th:nth-child(2){width:16%}.rc th:nth-child(4){width:34%}}
    </style>
    <div class="center bold" style="font-size:15px">${esc(r?.nombre ?? 'Innova365')}</div>
    ${settings.showAddress && r?.direccion ? `<div class="center">${esc(r.direccion)}</div>` : ''}${settings.showPhone && r?.telefono ? `<div class="center">${esc(r.telefono)}</div>` : ''}
    <hr style="${ruleCss}"/>
    <div class="center bold" style="font-size:14px">${esc(kind === 'recibo' ? settings.title : t('Cuenta'))} №${p.numero}</div>
    <div class="receipt-meta"><div>${printLang === 'en' ? 'Date and time' : 'Дата и время'}: ${esc(fmtDateTime(receiptDate))}</div>
    <div>${esc(p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar'))}</div>
    ${p.mesero?.rol === 'MESERO' && p.mesero.nombre ? `<div>${printLang === 'en' ? 'Waiter' : 'Официант'}: ${esc(p.mesero.nombre)}</div>` : ''}
    ${kind === 'recibo' && settings.showCashier && p.cajeroNombre ? `<div>${esc(cashierRole)}: ${esc(p.cajeroNombre)}</div>` : ''}</div>
    <div style="height:5px"></div>
    <table class="rc">
      <thead><tr><th>${printLang === 'en' ? 'Name' : 'Наименование'}</th><th class="right">${printLang === 'en' ? 'Qty' : 'Кол-во'}</th><th class="right col-price">${esc(t('Precio'))}</th><th class="right">${esc(t('Suma'))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="margin-top:6px">${Number(p.servicePercent ?? 0) > 0 ? `<tr><td style="border:0">${printLang === 'en' ? 'Items' : 'Блюда'}</td><td class="right" style="border:0">${fmtMoney(total - Number(p.serviceAmount ?? 0))}</td></tr><tr><td style="border:0">${printLang === 'en' ? 'Service charge' : 'Обслуживание'} ${Number(p.servicePercent)}%${p.mesero?.rol === 'MESERO' ? (printLang === 'en' ? ' (waiter)' : ' (официант)') : ''}</td><td class="right" style="border:0">${fmtMoney(Number(p.serviceAmount ?? 0))}</td></tr>` : ''}<tr><td class="bold" style="font-size:15px;border:0">${esc(kind === 'recibo' ? t('TOTAL') : t('A pagar'))}</td><td class="right bold" style="font-size:15px;border:0">${fmtMoney(total)}</td></tr>
    ${kind === 'recibo' && p.metodoPago ? `<tr><td style="border:0">${esc(t('Método de pago'))}</td><td class="right" style="border:0">${esc(payLabel(p.metodoPago))}</td></tr>` : ''}</table>
    <hr style="${ruleCss}"/>
    ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ''}
    <div class="center" style="margin-top:4px">${esc(kind === 'recibo' ? (r?.pieTicket || t('¡Gracias por su visita!')) : t('Cuenta previa. No es un comprobante de pago.'))}</div>
    ${kind === 'recibo' && settings.footer ? `<div class="center muted" style="margin-top:8px;font-size:10px">${esc(settings.footer)}</div>` : ''}`;
  return html;
}

/** Чек через окно печати Innova365 (предпросмотр, выбор принтера и ширины ленты). */
export async function printReceiptBrowser(p: Pedido, r: RestauranteInfo | undefined, kind: 'recibo' | 'cuenta', ancho?: number, opts: { autoPrint?: boolean } = {}) {
  return printHtml(await receiptHtml(p, r, kind), { title: `${kind === 'recibo' ? t('Recibo') : t('Cuenta')} №${p.numero}`, paper: ancho ?? printSettings(r?.printSettings).receipt.width, server: { tipo: kind, pedidoId: p.id }, autoPrint: opts.autoPrint });
}

// ───────── Итоговый кассовый отчёт на чековой ленте ─────────
export function cashReportHtml(d: CashReport, r?: RestauranteInfo): string {
  const settings = printSettings(r?.printSettings).report;
  const currency = getCurrency();
  const decimals = Math.max(currency.decimals,
    [d.revenue, d.cancelAmount, ...d.methods, ...d.staff, ...d.service, ...(d.departments ?? []), ...(d.clients ?? [])]
      .some((value) => !Number.isInteger(typeof value === 'number' ? value : value.total)) ? 2 : 0);
  const amount = (n: number) => n.toFixed(decimals);
  const reportMoney = (n: number) => currency.before ? `${currency.symbol}${amount(n)}` : `${amount(n)} ${currency.symbol}`;
  const grid = (title: string, widths: number[], headers: string[], rows: string[][], foot: string[]) => {
    const cells = (values: string[], header = false) => values.map((value, i) => `<${header ? 'th' : 'td'} class="${i > 1 ? 'right' : ''}">${esc(value)}</${header ? 'th' : 'td'}>`).join('');
    return `<section class="cash-report-section"><h2>${esc(title)}</h2><table class="cash-report-table">
      <colgroup>${widths.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>
      <thead><tr>${cells(headers, true)}</tr></thead>
      <tbody>${rows.length ? rows.map((row) => `<tr>${cells(row)}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="center muted">Нет данных</td></tr>`}</tbody>
      <tfoot><tr class="bold">${cells(foot)}</tr></tfoot></table></section>`;
  };
  const departments = d.departments ?? [];
  const clients = d.clients ?? [];
  const departmentTotal = departments.reduce((sum, row) => sum + row.total, 0);
  const departmentPositions = departments.reduce((sum, row) => sum + row.count, 0);
  const periodLabel = d.period === 'hoy' ? 'За сегодня' : d.period === 'semana' ? 'За 7 дней' : 'За месяц';
  const html = `<style>
    .cash-report{font-family:Arial,'Segoe UI',sans-serif}
    .cash-report-head{text-align:center;line-height:1.1;margin-bottom:7px}
    .cash-report-head strong{display:block;font-size:12px}
    .cash-report-head span{font-size:9px}
    .cash-report-meta{font-size:9px;line-height:1.3;margin-bottom:6px}
    .cash-report-facts{font-size:9px;line-height:1.25}
    .cash-report-facts div{display:flex;justify-content:space-between;gap:4px}
    .cash-report-facts b{white-space:nowrap}
    .cash-report-section{margin-top:9px;break-inside:avoid}
    .cash-report-section h2{text-align:center;margin:0 0 3px;font-size:10px;line-height:1.2}
    .cash-report-table{table-layout:fixed;width:100%;border-collapse:collapse}
    .cash-report-table th,.cash-report-table td{padding:1px;border:1px solid #333;font-size:8px;line-height:1.2}
    .cash-report-table th{text-transform:none;letter-spacing:0;white-space:nowrap;overflow-wrap:normal;font-weight:700}
    .cash-report-table td:nth-child(2){overflow-wrap:anywhere}
    .cash-report-table td:not(:nth-child(2)){white-space:nowrap}
  </style><div class="cash-report">
    <div class="cash-report-head"><strong>${esc(settings.title)}</strong><span>${periodLabel}</span></div>
    <div class="cash-report-meta">От: ${esc(d.from)}<br>До: ${esc(d.to)}<br>Торговая точка: ${esc(r?.nombre ?? 'Innova365')}<br>Дата: ${esc(d.generatedAt)}</div>
    <div class="cash-report-facts">
      <div><span>Всего счетов:</span><b>${d.created}</b></div>
      <div><span>Позиций заказов:</span><b>${d.orderedPositions ?? d.positions}</b></div>
      <div><span>Чеков с отказом:</span><b>${d.cancelled}</b></div>
      <div><span>Позиций отказов:</span><b>${d.cancelledPositions ?? 0}</b></div>
      <div><span>Сумма отказов:</span><b>${reportMoney(d.cancelAmount)}</b></div>
      <div><span>Гостей:</span><b>—</b></div>
      <div><span>Переносов:</span><b>—</b></div>
      <div><span>Разблокировок:</span><b>—</b></div>
      <div class="bold"><span>Выручка:</span><b>${reportMoney(d.revenue)}</b></div>
    </div>
    ${grid('Отчёт по видам оплат', [7, 58, 35], ['№', 'Вид оплаты', 'Сумма'], d.methods.map((row, i) => [String(i + 1), payLabel(row.name), amount(row.total)]), ['', 'Итого', amount(d.revenue)])}
    ${grid('Отчёт по сотрудникам', [7, 43, 15, 35], ['№', 'Сотрудник', 'Кол.', 'Сумма'], d.staff.map((row, i) => [String(i + 1), row.name, String(row.count), amount(row.total)]), ['', 'Итого', String(d.paid), amount(d.revenue)])}
    ${grid('Отчёт по подразделениям', [7, 43, 15, 35], ['№', 'Подразделение', 'Кол.', 'Сумма'], departments.map((row, i) => [String(i + 1), row.name, String(row.count), amount(row.total)]), ['', 'Итого', String(departmentPositions), amount(departmentTotal)])}
    ${grid('По типу обслуживания', [7, 43, 15, 35], ['№', 'Тип', 'Кол.', 'Сумма'], d.service.map((row, i) => [String(i + 1), row.name, String(row.count), amount(row.total)]), ['', 'Итого', String(d.paid), amount(d.revenue)])}
    ${grid('Отчёт по клиентам', [6, 34, 12, 13, 35], ['№', 'Клиент', 'Сч.', 'Поз.', 'Сумма'], clients.map((row, i) => [String(i + 1), row.name, String(row.bills), String(row.positions), amount(row.total)]), ['', 'Итого', String(d.paid), String(d.positions), amount(d.revenue)])}
    <div class="center muted" style="font-size:8px;margin-top:6px">${esc(currencySymbol())}</div></div>`;
  return html;
}

export function printCashReport(d: CashReport, r?: RestauranteInfo, options: { autoPrint?: boolean } = {}) {
  const settings = printSettings(r?.printSettings).report;
  return printHtml(cashReportHtml(d, r), { title: settings.title, paper: settings.width, server: { tipo: 'cierre', periodo: d.period }, autoPrint: options.autoPrint });
}

// ───────── Отчёт о продажах (A4) ─────────
export interface VentasReport {
  periodo: string;
  totalVentas: number;
  totalPedidos: number;
  chartData: { fecha: string; ventas: number }[];
  top: { nombre: string; cantidad: number; ingresos: number; porcentaje: number }[];
  productividad: { nombre: string; pedidos: number; tiempoPromedio: number }[];
}

export function printVentasReport(d: VentasReport, r?: RestauranteInfo) {
  const days = d.chartData.map((x) => `<tr><td>${esc(x.fecha)}</td><td class="right">${fmtMoney(x.ventas)}</td></tr>`).join('');
  const top = d.top.map((x, n) => `<tr><td>${n + 1}</td><td>${esc(x.nombre)}</td><td class="right">${x.cantidad}</td><td class="right">${fmtMoney(x.ingresos)}</td><td class="right">${x.porcentaje}%</td></tr>`).join('');
  const prod = d.productividad.map((x) => `<tr><td>${esc(x.nombre)}</td><td class="right">${x.pedidos}</td><td class="right">${x.tiempoPromedio} ${esc(t('min'))}</td></tr>`).join('');
  const html = `${head(r, t('Reporte de ventas'), d.periodo)}
    <table style="margin-bottom:6px"><tr>
      <td><div class="muted">${esc(t('Total ventas'))}</div><div class="bold" style="font-size:20px">${fmtMoney(d.totalVentas)}</div></td>
      <td><div class="muted">${esc(t('Pedidos pagados'))}</div><div class="bold" style="font-size:20px">${d.totalPedidos}</div></td>
      <td><div class="muted">${esc(t('Promedio por pedido'))}</div><div class="bold" style="font-size:20px">${fmtMoney(d.totalPedidos ? d.totalVentas / d.totalPedidos : 0)}</div></td></tr></table>
    <h2>${esc(t('Ventas por día'))}</h2>
    <table><thead><tr><th>${esc(t('Fecha'))}</th><th class="right">${esc(t('Ventas ({c})', { c: currencySymbol() }))}</th></tr></thead><tbody>${days || `<tr><td colspan="2" class="muted">${esc(t('Sin datos para el período'))}</td></tr>`}</tbody></table>
    <h2>${esc(t('Top Productos'))}</h2>
    <table><thead><tr><th>#</th><th>${esc(t('Producto'))}</th><th class="right">${esc(t('Cantidad vendida'))}</th><th class="right">${esc(t('Ingresos'))}</th><th class="right">${esc(t('% del total'))}</th></tr></thead><tbody>${top}</tbody></table>
    ${prod ? `<h2>${esc(t('Готовые заказы по сотрудникам кухни'))}</h2><table><thead><tr><th>${esc(t('Nombre'))}</th><th class="right">${esc(t('Pedidos atendidos'))}</th><th class="right">${esc(t('Время от заказа до готовности (мин)'))}</th></tr></thead><tbody>${prod}</tbody></table>` : ''}`;
  return printHtml(html, { title: t('Reporte de ventas'), paper: 'A4' });
}

// ───────── Тех-карта блюда (A4) ─────────
export interface TechCardDoc {
  nombre: string; precio: number; rendimiento: number | null; tecnologia: string; costo: number; margen: number | null;
  items: { nombre: string; unidad: string; bruto: number; neto: number | null; coldLossPct?: number | null; hotLossPct?: number | null; costo: number | null }[];
}

/** Технологическая карта: состав на 1 порцию (брутто/нетто), выход, технология, себестоимость и наценка. */
export function printTechCard(c: TechCardDoc, r?: RestauranteInfo) {
  const rows = c.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.nombre)}</td><td class="right">${fmtQty(i.bruto)} ${esc(i.unidad)}</td><td class="right">${i.coldLossPct === null || i.coldLossPct === undefined ? '—' : `${fmtQty(i.coldLossPct)}%`}</td><td class="right">${i.hotLossPct === null || i.hotLossPct === undefined ? '—' : `${fmtQty(i.hotLossPct)}%`}</td><td class="right">${i.neto === null ? '' : `${fmtQty(i.neto)} ${esc(i.unidad)}`}</td><td class="right">${i.costo === null ? '—' : fmtMoney(i.costo)}</td></tr>`).join('');
  const html = `${head(r, `${t('Ficha técnica')}: ${c.nombre}`, t('1 porción'))}
    <table style="margin-bottom:8px"><tr>
      <td><div class="muted">${esc(t('Rendimiento, g'))}</div><div class="bold" style="font-size:18px">${c.rendimiento ?? '—'}</div></td>
      <td><div class="muted">${esc(t('Costo de la porción'))}</div><div class="bold" style="font-size:18px">${fmtMoney(c.costo)}</div></td>
      <td><div class="muted">${esc(t('Precio'))}</div><div class="bold" style="font-size:18px">${fmtMoney(c.precio)}</div></td>
      <td><div class="muted">${esc(t('Margen'))}</div><div class="bold" style="font-size:18px">${c.margen === null ? '—' : `${c.margen.toFixed(0)}%`}</div></td></tr></table>
    <table><thead><tr><th>#</th><th>${esc(t('Ingrediente / plato'))}</th><th class="right">${esc(t('Bruto'))}</th><th class="right">Холодная, %</th><th class="right">Горячая, %</th><th class="right">${esc(t('Neto'))}</th><th class="right">${esc(t('Costo'))}</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="6" class="right bold">${esc(t('Costo de la porción'))}</td><td class="right bold">${fmtMoney(c.costo)}</td></tr></tfoot></table>
    ${c.tecnologia ? `<h2>${esc(t('Tecnología de preparación'))}</h2><div style="white-space:pre-wrap">${esc(c.tecnologia)}</div>` : ''}
    <div class="sign"><div>${esc(t('Chef'))}</div><div>${esc(t('Administrador'))}</div></div>`;
  return printHtml(html, { title: `${t('Ficha técnica')} ${c.nombre}`, paper: 'A4' });
}
