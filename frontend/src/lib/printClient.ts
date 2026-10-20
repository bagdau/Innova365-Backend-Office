import toast from 'react-hot-toast';
import { impresionService } from '../services/impresion.service';
import { reportesService } from '../services/reportes.service';
import { printReceiptBrowser, type RestauranteInfo } from './documents';
import { getQuickPrint } from './printPanel';
import { getLocalCfg, probeAgent, printLocal } from './localPrinter';
import { usbSupport, savedPrinter, printUsb } from './usbPrinter';
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

let restCache: RestauranteInfo | undefined;
async function restaurante(): Promise<RestauranteInfo | undefined> {
  if (restCache) return restCache;
  try { restCache = await reportesService.getRestaurante(); } catch { /* sin шапки */ }
  return restCache;
}

/**
 * Печать чека / счёта: сначала на настроенный кассовый принтер (сеть или USB через агент),
 * если принтера нет или он недоступен — через окно печати браузера.
 */
export async function printOrder(kind: 'recibo' | 'cuenta', pedido: Pedido): Promise<void> {
  // обычно — окно печати Innova365 (предпросмотр, принтер, размер); «печатать сразу» — прямо на принтер
  if (!getQuickPrint()) return printReceiptBrowser(pedido, await restaurante(), kind, 80);
  return printOrderDirect(kind, pedido);
}

async function printOrderDirect(kind: 'recibo' | 'cuenta', pedido: Pedido): Promise<void> {
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
      await printReceiptBrowser(pedido, await restaurante(), kind, r.ancho || 80);
    }
  } catch (e: any) {
    toast.dismiss(loading);
    if (e?.response?.status === 403) { toast.error(t('Sin permisos para esta acción')); return; }
    // нет связи с сервером печати → браузер
    await printReceiptBrowser(pedido, await restaurante(), kind, 80);
  }
}

/** Печать на сетевой IP-принтер этого рабочего места (через агент на ПК или с сервера). */
export async function printViaIp(tipo: 'recibo' | 'cuenta', pedidoId: string): Promise<boolean> {
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
export async function printViaPreferred(tipo: 'recibo' | 'cuenta', pedidoId: string): Promise<boolean> {
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
export async function printViaUsb(tipo: 'recibo' | 'cuenta', pedidoId: string): Promise<boolean> {
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
export async function printViaLocalAgent(tipo: 'recibo' | 'cuenta', pedidoId: string): Promise<boolean> {
  const cfg = getLocalCfg();
  if (!cfg.enabled) return false;
  const a = await probeAgent(cfg.url);
  if (!a.online || a.allowed === false) return false;
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
export interface RespuestaPago { impresion?: { impreso: boolean; impresora: string | null; intentos: number } }

/**
 * Чек сразу после «Оплачено»: автопечать сервера → иначе любой подходящий принтер (умный выбор) → иначе окно печати
 * с автозапуском (для принтера, установленного в Windows этого компьютера). Чек не теряется ни в одном случае.
 */
export async function printAfterPayment(pedido: Pedido, metodo: string, resp?: RespuestaPago): Promise<void> {
  if (resp?.impresion?.impreso) { toast.success(t('Impreso: {name}', { name: resp.impresion.impresora ?? '' })); return; }
  const paid = { ...pedido, estado: 'PAGADO', pagado: true, metodoPago: metodo } as Pedido;
  if (await printViaPreferred('recibo', pedido.id)) return;           // USB / агент / IP-принтер этого рабочего места — сначала тот, что сработал в прошлый раз
  try {
    const r = await impresionService.imprimir({ tipo: 'recibo', pedidoId: pedido.id, impresoraId: getDevicePrinter() ?? undefined, lang });
    const ok = r.resultados.find((x) => x.ok);
    if (ok) { toast.success(t('Impreso: {name}', { name: ok.impresora })); return; }
  } catch { /* нет связи с сервером печати — откроем окно печати */ }
  // нет ни агента, ни принтера: открываем окно Innova365 (предпросмотр + как подключить принтер). Системное окно браузера не используется.
  await printReceiptBrowser(paid, await restaurante(), 'recibo', 80);
}

/** Итоги дня на чековом принтере (кассир / администратор). */
export async function printDayClosing(): Promise<void> {
  const loading = toast.loading(t('Imprimiendo...'));
  try {
    const r = await impresionService.imprimir({ tipo: 'cierre', impresoraId: getDevicePrinter() ?? undefined, lang });
    toast.dismiss(loading);
    if (r.resultados.some((x) => x.ok)) toast.success(t('Impreso: {name}', { name: r.resultados.filter((x) => x.ok).map((x) => x.impresora).join(', ') }));
    else toast.error(r.resultados.length ? t('No se pudo imprimir') : t('No hay impresora configurada para reportes'));
  } catch {
    toast.dismiss(loading);
    toast.error(t('No se pudo imprimir'));
  }
}
