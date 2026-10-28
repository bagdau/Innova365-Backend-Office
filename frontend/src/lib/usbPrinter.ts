import { api } from '../services/api';
import { printLang } from '../i18n';
import { getLocalCfg } from './localPrinter';

/**
 * Печать прямо из браузера на USB-принтер (WebUSB) — без агента и без драйверной печати Windows.
 * Браузер получает байты ESC/POS от сервера и отправляет их в bulk-OUT endpoint принтера.
 *
 * Требования: Chrome/Edge; страница в «безопасном контексте» (localhost, https или запуск через start-pos-browser.bat);
 * для принтера в Windows установлен драйвер WinUSB (один раз, программа Zadig) — штатный драйвер печати Windows
 * занимает устройство, и браузеру его не отдаёт.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Usb = any;
const KEY = 'innova365-usb-printer';

const usb = (): Usb | undefined => (typeof navigator !== 'undefined' ? (navigator as unknown as { usb?: Usb }).usb : undefined);

export type UsbSupport = 'ok' | 'insecure' | 'unsupported';
export function usbSupport(): UsbSupport {
  if (!usb()) return typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'unsupported';
  return 'ok';
}

export interface UsbInfo { vendorId: number; productId: number; name: string }
const info = (d: Usb): UsbInfo => ({ vendorId: d.vendorId, productId: d.productId, name: d.productName || d.manufacturerName || `USB ${d.vendorId.toString(16)}:${d.productId.toString(16)}` });

/** Принтеры, которым пользователь уже дал доступ (кнопка «Подключить USB-принтер» нужна один раз). */
export async function grantedPrinters(): Promise<Usb[]> {
  const u = usb(); if (!u) return [];
  try { return await u.getDevices(); } catch { return []; }
}
export async function savedPrinter(): Promise<{ dev: Usb; info: UsbInfo } | null> {
  const list = await grantedPrinters();
  if (list.length === 0) return null;
  let want: { vendorId: number; productId: number } | null = null;
  try { want = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* ignore */ }
  const dev = list.find((d) => want && d.vendorId === want.vendorId && d.productId === want.productId) ?? list[0];
  return { dev, info: info(dev) };
}

/** Окно выбора устройства браузера (нужен клик пользователя). */
export async function connectUsbPrinter(): Promise<UsbInfo> {
  const u = usb();
  if (!u) throw new Error(usbSupport() === 'insecure' ? 'insecure' : 'unsupported');
  const dev = await u.requestDevice({ filters: [] });
  try { localStorage.setItem(KEY, JSON.stringify({ vendorId: dev.vendorId, productId: dev.productId })); } catch { /* ignore */ }
  window.dispatchEvent(new Event('innova:usbprinter'));
  return info(dev);
}

const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Отправляет байты на принтер: открывает устройство, находит bulk-OUT endpoint, пишет порциями. */
export async function sendUsb(dev: Usb, data: Uint8Array): Promise<void> {
  try {
    await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);
    // интерфейс принтера (класс 7) или любой с bulk-OUT
    let iface: Usb = null; let ep: Usb = null;
    for (const i of dev.configuration.interfaces as Usb[]) {
      for (const alt of i.alternates as Usb[]) {
        const out = (alt.endpoints as Usb[]).find((e) => e.direction === 'out' && e.type === 'bulk');
        if (out && (!iface || alt.interfaceClass === 7)) { iface = i; ep = out; }
      }
    }
    if (!iface || !ep) throw new Error('no bulk-out endpoint (not a printer interface)');
    await dev.claimInterface(iface.interfaceNumber);
    try {
      const size = Math.max(64, ep.packetSize ?? 64) * 64;
      for (let off = 0; off < data.length; off += size) {
        const r = await dev.transferOut(ep.endpointNumber, data.slice(off, off + size));
        if (r.status !== 'ok') throw new Error(`transfer ${r.status}`);
      }
    } finally { try { await dev.releaseInterface(iface.interfaceNumber); } catch { /* ignore */ } }
  } catch (e) {
    const m = (e as Error).message ?? String(e);
    if (/claim|access denied|busy|SecurityError|NetworkError/i.test(m)) throw new Error('winusb');   // Windows держит принтер своим драйвером
    throw e;
  } finally { try { await dev.close(); } catch { /* ignore */ } }
}

/** Печатает документ через USB. Ошибки: 'insecure' | 'unsupported' | 'no-device' | 'winusb' | текст. */
export async function printUsb(doc: { tipo: 'recibo' | 'cuenta' | 'cocina' | 'cierre' | 'prueba'; pedidoId?: string; periodo?: 'hoy' | 'semana' | 'mes' }, ancho?: number): Promise<{ printer: string }> {
  if (!usb()) throw new Error(usbSupport());
  const saved = await savedPrinter();
  if (!saved) throw new Error('no-device');
  const cfg = getLocalCfg();
  const { data } = await api.post<{ data: string }>('/imprimir/bytes', { ...doc, ancho: ancho ?? cfg.ancho, codepage: cfg.codepage, lang: printLang }, { timeout: 10000 });
  await sendUsb(saved.dev, b64ToBytes(data.data));
  return { printer: saved.info.name };
}
