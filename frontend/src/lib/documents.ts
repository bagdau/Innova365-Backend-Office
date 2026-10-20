import { esc, fmtDateTime, fmtMoney, fmtQty } from './print';
import { printHtml } from './printPanel';
import { t } from '../i18n';
import { currencyCode, currencySymbol } from './currency';
import { payLabel } from './payments';
import type { Compra, Insumo, Movimiento, Pedido } from '../types';

export interface RestauranteInfo { nombre: string; direccion?: string | null; telefono?: string | null; pieTicket?: string | null; qrTicket?: string | null }

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
  const d = new Date(p.creadoEn);
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
  // узкая лента (≤ 65 мм) прячет колонку «Цена» — это решает CSS по ширине страницы, поэтому ширину можно менять в окне печати
  const rows = p.items.map((i) => `
    <tr><td>${esc(i.producto.nombre)}</td><td class="right">${i.cantidad}</td><td class="right col-price">${Number(i.precio).toFixed(2)}</td><td class="right bold">${Number(i.subtotal).toFixed(2)}</td></tr>`).join('');

  let qrSvg = '';
  if (kind === 'recibo') {
    try {
      const QR = await import('qrcode');
      qrSvg = await QR.toString(qrText(r?.qrTicket, r, p), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    } catch { /* без QR печатаем чек как есть */ }
  }

  const ruleCss = 'border:0;border-top:1px dashed #000;margin:6px 0';
  const html = `
    <style>
      .rc td,.rc th{padding:3px 2px;border:0;border-bottom:1px solid #999;font-size:12px}
      .rc th{border-bottom:1.5px solid #000;font-size:10.5px;white-space:nowrap}
      .rc{border:1px solid #000;border-collapse:collapse}
      .rc td,.rc th{border-left:1px solid #000;border-right:1px solid #000}
      .info td{border:0;padding:1px 0}
      .qr{width:36mm;margin:8px auto 2px} .qr svg{display:block;width:100%;height:auto}
      @media (max-width:65mm){.col-price{display:none}.qr{width:30mm}}
    </style>
    <div class="center bold" style="font-size:15px">${esc(r?.nombre ?? 'Innova365')}</div>
    ${r?.direccion ? `<div class="center">${esc(r.direccion)}</div>` : ''}${r?.telefono ? `<div class="center">${esc(r.telefono)}</div>` : ''}
    <hr style="${ruleCss}"/>
    <div class="center bold" style="font-size:14px">${esc(kind === 'recibo' ? t('Recibo') : t('Cuenta'))} №${p.numero}</div>
    <table class="info"><tr><td>${esc(fmtDateTime(p.creadoEn))}</td><td class="right">${esc(p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar'))}</td></tr>
    ${p.mesero ? `<tr><td colspan="2" class="muted">${esc(t('Mesero'))}: ${esc(p.mesero.nombre)}</td></tr>` : ''}</table>
    <div style="height:5px"></div>
    <table class="rc">
      <thead><tr><th>${esc(t('Producto'))}</th><th class="right">${esc(t('Cant'))}</th><th class="right col-price">${esc(t('Precio'))}</th><th class="right">${esc(t('Suma'))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="margin-top:6px"><tr><td class="bold" style="font-size:15px;border:0">${esc(kind === 'recibo' ? t('TOTAL') : t('A pagar'))}</td><td class="right bold" style="font-size:15px;border:0">${fmtMoney(total)}</td></tr>
    ${kind === 'recibo' && p.metodoPago ? `<tr><td style="border:0">${esc(t('Método de pago'))}</td><td class="right" style="border:0">${esc(payLabel(p.metodoPago))}</td></tr>` : ''}</table>
    <hr style="${ruleCss}"/>
    ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ''}
    <div class="center" style="margin-top:4px">${esc(kind === 'recibo' ? (r?.pieTicket || t('¡Gracias por su visita!')) : t('Cuenta previa. No es un comprobante de pago.'))}</div>`;
  return html;
}

/** Чек через окно печати Innova365 (предпросмотр, выбор принтера и ширины ленты). */
export async function printReceiptBrowser(p: Pedido, r: RestauranteInfo | undefined, kind: 'recibo' | 'cuenta', ancho = 80, opts: { autoPrint?: boolean } = {}) {
  return printHtml(await receiptHtml(p, r, kind), { title: `${kind === 'recibo' ? t('Recibo') : t('Cuenta')} №${p.numero}`, paper: ancho, server: { tipo: kind, pedidoId: p.id }, autoPrint: opts.autoPrint });
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
    ${prod ? `<h2>${esc(t('Productividad por cocinero'))}</h2><table><thead><tr><th>${esc(t('Nombre'))}</th><th class="right">${esc(t('Pedidos atendidos'))}</th><th class="right">${esc(t('Tiempo promedio (min)'))}</th></tr></thead><tbody>${prod}</tbody></table>` : ''}`;
  return printHtml(html, { title: t('Reporte de ventas'), paper: 'A4' });
}

// ───────── Тех-карта блюда (A4) ─────────
export interface TechCardDoc {
  nombre: string; precio: number; rendimiento: number | null; tecnologia: string; costo: number; margen: number | null;
  items: { nombre: string; unidad: string; bruto: number; neto: number | null; costo: number | null }[];
}

/** Технологическая карта: состав на 1 порцию (брутто/нетто), выход, технология, себестоимость и наценка. */
export function printTechCard(c: TechCardDoc, r?: RestauranteInfo) {
  const rows = c.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.nombre)}</td><td class="right">${fmtQty(i.bruto)} ${esc(i.unidad)}</td><td class="right">${i.neto === null ? '' : `${fmtQty(i.neto)} ${esc(i.unidad)}`}</td><td class="right">${i.costo === null ? '—' : fmtMoney(i.costo)}</td></tr>`).join('');
  const html = `${head(r, `${t('Ficha técnica')}: ${c.nombre}`, t('1 porción'))}
    <table style="margin-bottom:8px"><tr>
      <td><div class="muted">${esc(t('Rendimiento, g'))}</div><div class="bold" style="font-size:18px">${c.rendimiento ?? '—'}</div></td>
      <td><div class="muted">${esc(t('Costo de la porción'))}</div><div class="bold" style="font-size:18px">${fmtMoney(c.costo)}</div></td>
      <td><div class="muted">${esc(t('Precio'))}</div><div class="bold" style="font-size:18px">${fmtMoney(c.precio)}</div></td>
      <td><div class="muted">${esc(t('Margen'))}</div><div class="bold" style="font-size:18px">${c.margen === null ? '—' : `${c.margen.toFixed(0)}%`}</div></td></tr></table>
    <table><thead><tr><th>#</th><th>${esc(t('Ingrediente / plato'))}</th><th class="right">${esc(t('Bruto'))}</th><th class="right">${esc(t('Neto'))}</th><th class="right">${esc(t('Costo'))}</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" class="right bold">${esc(t('Costo de la porción'))}</td><td class="right bold">${fmtMoney(c.costo)}</td></tr></tfoot></table>
    ${c.tecnologia ? `<h2>${esc(t('Tecnología de preparación'))}</h2><div style="white-space:pre-wrap">${esc(c.tecnologia)}</div>` : ''}
    <div class="sign"><div>${esc(t('Chef'))}</div><div>${esc(t('Administrador'))}</div></div>`;
  return printHtml(html, { title: `${t('Ficha técnica')} ${c.nombre}`, paper: 'A4' });
}
