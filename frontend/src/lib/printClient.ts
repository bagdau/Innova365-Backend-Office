import toast from 'react-hot-toast';
import { impresionService } from '../services/impresion.service';
import { reportesService } from '../services/reportes.service';
import { printReceiptBrowser, printCashReport, type RestauranteInfo } from './documents';
import { getQuickPrint } from './printPanel';
import { getLocalCfg, probeAgent, agentPrinters, rawPrinterName, printLocal } from './localPrinter';
import { usbSupport, savedPrinter, printUsb } from './usbPrinter';
import { hasNativePrinter } from './nativePrinter';
import { selectedIpPrinter, printIp, getPref, setPref, type Pref } from './ipPrinters';
import { printLang as lang } from '../i18n';
import { t } from '../i18n';
import type { Pedido } from '../types';

const DEVICE_KEY = 'innova365-printer';

/** Принтер, закреплённый за этим устройством (кассовый ПК печатает на свой принтер). */
export function getDevicePrinter(): string | null {
  try { return localStorage.getItem(DEVICE_KEY); } catch { return null; }
}
export function setDevicePrinter(id: string | null) {
  try { id ? localStorage.setItem(DEVICE_KEY, id) : localStorage.removeItem(DEVICE_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event('innova:printer'));
}

async function restaurante(): Promise<RestauranteInfo | undefined> {
  try { return await reportesService.getRestaurante(); } catch { return undefined; }
}

/**
 * Печать чека / счёта: сначала на настроенный кассовый принтер (сеть или USB через агент),
 * если принтера нет или он недоступен — через окно печати браузера.
 */
export async function printOrder(kind: 'recibo' | 'cuenta', pedido: Pedido): Promise<void> {
  // обычно — окно печати Innova365 (предпросмотр, принтер, размер); «печатать сразу» — прямо на принтер
  if (!getQuickPrint()) return printReceiptBrowser(pedido, await restaurante(), kind);
  return printOrderDirect(kind, pedido);
}

async function printOrderDirect(kind: 'recibo' | 'cuenta', pedido: Pedido): Promise<void> {
  if (hasNativePrinter()) return printReceiptBrowser(pedido, await restaurante(), kind, undefined, { autoPrint: true });
  if (getPref() === 'system') return printReceiptBrowser(pedido, await restaurante(), kind, undefined, { autoPrint: true });
  if (await printViaPreferred(kind, pedido.id)) return;
  const loading = toast.loading(t('Imprimiendo...'));
  try {
    const r = await impresionService.imprimir({ tipo: kind, pedidoId: pedido.id, impresoraId: getDevicePrinter() ?? undefined, lang });
    toast.dismiss(loading);
    const ok = r.resultados.filter((x) => x.ok);
    const bad = r.resultados.filter((x) => !x.ok);
    if (ok.length) toast.success(t('Impreso: {name}', { name: ok.map((x) => x.impresora).join(', ') }));
    bad.forEach((x) => toast.error(`${x.impresora}: ${t('No se pudo imprimir')}${x.detalle ? ' — ' + x.detalle : ''}`, { duration: 7000 }));
    if (r.fallback) {
      if (bad.length) toast(t('Se abre la impresión del navegador'), { icon: '🖨️' });
      await printReceiptBrowser(pedido, await restaurante(), kind, r.ancho || undefined);
    }
  } catch (e: any) {
    toast.dismiss(loading);
    if (e?.response?.status === 403) { toast.error(t('Sin permisos para esta acción')); return; }
    // нет связи с сервером печати → браузер
    await printReceiptBrowser(pedido, await restaurante(), kind);
  }
}

/** Печать на сетевой IP-принтер этого рабочего места (через агент на ПК или с сервера). */
export async function printViaIp(tipo: 'recibo' | 'cuenta' | 'cierre', pedidoId?: string): Promise<boolean> {
  const p = selectedIpPrinter();
  if (!p) return false;
  try {
    const r = await printIp({ tipo, pedidoId }, p);
    toast.success(t('Impreso: {name}', { name: r.printer }));
    return true;
  } catch (e) {
    toast.error(`${t('No se pudo imprimir')} — ${t('{ip} no responde. Revisa el cable, la IP y que esté en la misma red.', { ip: p.ip })}`, { duration: 7000 });
    return false;
  }
}

/** Пробует способы печати этого компьютера (USB, агент, IP) — сначала тот, что сработал в прошлый раз. */
export async function printViaPreferred(tipo: 'recibo' | 'cuenta' | 'cierre', pedidoId?: string): Promise<boolean> {
  if (hasNativePrinter()) return false; // Electron выбирает принтер Windows в окне печати
  if (getPref() === 'system') return false;
  const fns: Record<'usb' | 'local' | 'ip', () => Promise<boolean>> = {
    usb: () => printViaUsb(tipo, pedidoId), local: () => printViaLocalAgent(tipo, pedidoId), ip: () => printViaIp(tipo, pedidoId),
  };
  const pref = getPref();
  const order = (['usb', 'local', 'ip'] as const).slice().sort((a, b) => (a === pref ? -1 : 0) - (b === pref ? -1 : 0));
  for (const k of order) {
    if (await fns[k]()) { setPref(k as Pref); return true; }
  }
  return false;
}

/** Печать на USB-принтер напрямую из браузера (WebUSB), если он уже подключён на этом компьютере. */
export async function printViaUsb(tipo: 'recibo' | 'cuenta' | 'cierre', pedidoId?: string): Promise<boolean> {
  if (usbSupport() !== 'ok' || !(await savedPrinter())) return false;
  try {
    const r = await printUsb({ tipo, pedidoId });
    toast.success(t('Impreso: {name}', { name: r.printer }));
    return true;
  } catch (e) {
    toast.error(`${t('No se pudo imprimir')} — ${(e as Error).message === 'winusb' ? t('Windows ocupa la impresora con su controlador: instala WinUSB con Zadig (ver instrucciones abajo)') : (e as Error).message}`, { duration: 7000 });
    return false;
  }
}

/** Печать на принтере этого компьютера через локальный агент. true — напечатано; false — агента нет/сбой (идём дальше по цепочке). */
export async function printViaLocalAgent(tipo: 'recibo' | 'cuenta' | 'cierre', pedidoId?: string): Promise<boolean> {
  const cfg = getLocalCfg();
  if (!cfg.enabled) return false;
  const a = await probeAgent(cfg.url);
  if (!a.online || a.allowed === false) return false;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(cfg.printer.trim())) {
    try {
      const printers = await agentPrinters(cfg.url);
      if (!rawPrinterName(cfg.printer, printers)) return false;
    } catch { return false; }
  }
  try {
    const r = await printLocal({ tipo, pedidoId }, cfg);
    toast.success(t('Impreso: {name}', { name: r.printer }));
    return true;
  } catch (e) {
    toast.error(`${t('No se pudo imprimir')} — ${(e as Error).message}`, { duration: 6000 });
    return false;
  }
}

/** Ответ сервера на оплату: напечатал ли он чек сам (автопечать на принтере с галочкой «Авто»). */
export interface RespuestaPago {
  cajeroNombre?: string | null;
  cajeroRol?: string | null;
  actualizadoEn?: string;
  pagadoEn?: string | null;
  impresion?: { impreso: boolean; impresora: string | null; intentos: number };
}

/**
 * Чек сразу после «Оплачено»: автопечать сервера → иначе любой подходящий принтер (умный выбор) → иначе окно печати
 * с автозапуском (для принтера, установленного в Windows этого компьютера). Чек не теряется ни в одном случае.
 */
export async function printAfterPayment(pedido: Pedido, metodo: string, resp?: RespuestaPago): Promise<void> {
  if (resp?.impresion?.impreso) { toast.success(t('Impreso: {name}', { name: resp.impresion.impresora ?? '' })); return; }
  const paid = { ...pedido, estado: 'PAGADO', pagado: true, metodoPago: metodo,
    actualizadoEn: resp?.actualizadoEn ?? new Date().toISOString(),
    pagadoEn: resp?.pagadoEn ?? new Date().toISOString(),
    cajeroNombre: resp?.cajeroNombre ?? pedido.cajeroNombre,
    cajeroRol: resp?.cajeroRol ?? pedido.cajeroRol } as Pedido;
  if (hasNativePrinter()) { await printReceiptBrowser(paid, await restaurante(), 'recibo', undefined, { autoPrint: true }); return; }
  if (getPref() === 'system') { await printReceiptBrowser(paid, await restaurante(), 'recibo', undefined, { autoPrint: true }); return; }
  if (await printViaPreferred('recibo', pedido.id)) return;           // USB / агент / IP-принтер этого рабочего места — сначала тот, что сработал в прошлый раз
  try {
    const r = await impresionService.imprimir({ tipo: 'recibo', pedidoId: pedido.id, impresoraId: getDevicePrinter() ?? undefined, lang });
    const ok = r.resultados.find((x) => x.ok);
    if (ok) { toast.success(t('Impreso: {name}', { name: ok.impresora })); return; }
  } catch { /* нет связи с сервером печати — откроем окно печати */ }
  // Если чековый принтер недоступен, открываем предпросмотр с системной печатью браузера.
  await printReceiptBrowser(paid, await restaurante(), 'recibo');
}

/** Итоги дня на чековом принтере (кассир / администратор). */
let dayClosingBusy = false;
export async function printDayClosing(): Promise<void> {
  if (dayClosingBusy) return;
  dayClosingBusy = true;
  try {
    const report = await reportesService.getCashReport('hoy');
    await printCashReport(report, await restaurante());
  } catch {
    toast.error(t('No se pudo imprimir'));
  } finally { dayClosingBusy = false; }
}
