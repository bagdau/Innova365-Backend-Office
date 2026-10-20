import { api } from '../services/api';
import { impresionService } from '../services/impresion.service';
import { printLang } from '../i18n';
import { getLocalCfg, probeAgent, printLocal } from './localPrinter';

/**
 * Сетевые (IP) принтеры этого рабочего места. Адреса хранятся в браузере кассы.
 * Печать: сначала через агент на этом ПК (он передаёт данные на порт 9100 принтера — работает, даже если сервер в интернете),
 * если агента нет — с сервера (работает, когда сервер стоит в той же сети, что и принтер).
 */
export interface IpPrinter { ip: string; port: number; name: string }

const KEY = 'innova365-ip-printers';
const SEL = 'innova365-ip-selected';
const PREF = 'innova365-print-pref';

export type Pref = 'usb' | 'local' | 'ip' | 'server';

const read = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } window.dispatchEvent(new Event('innova:ipprinters')); };

export const getIpPrinters = (): IpPrinter[] => read<IpPrinter[]>(KEY, []);
export const getSelectedIp = (): string | null => read<string | null>(SEL, null);
export const setSelectedIp = (ip: string | null) => write(SEL, ip);
export const parseIp = (s: string): { ip: string; port: number } | null => {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?$/.exec(s.trim());
  if (!m || m[1].split('.').some((x) => Number(x) > 255)) return null;
  return { ip: m[1], port: m[2] ? Number(m[2]) : 9100 };
};
export function addIpPrinter(ip: string, port = 9100, name = ''): IpPrinter[] {
  const list = getIpPrinters().filter((p) => !(p.ip === ip && p.port === port));
  list.push({ ip, port, name: name || ip });
  write(KEY, list); setSelectedIp(ip);
  return list;
}
export function removeIpPrinter(ip: string) {
  write(KEY, getIpPrinters().filter((p) => p.ip !== ip));
  if (getSelectedIp() === ip) setSelectedIp(null);
}
export const selectedIpPrinter = (): IpPrinter | null => { const l = getIpPrinters(); return l.find((p) => p.ip === getSelectedIp()) ?? l[0] ?? null; };

/** Способ печати, который в последний раз сработал на этом компьютере: им и печатаем чек после оплаты. */
export const getPref = (): Pref | null => read<Pref | null>(PREF, null);
export const setPref = (p: Pref) => write(PREF, p);

/** Поиск принтеров в сети: через агент на этом ПК (видит локальную сеть кассы), иначе через сервер. */
export async function discoverIp(): Promise<string[]> {
  const cfg = getLocalCfg();
  const a = await probeAgent(cfg.url);
  if (a.online && a.allowed !== false) {
    const r = await fetch(`${cfg.url.replace(/\/+$/, '')}/discover`, { signal: AbortSignal.timeout(15000) });
    if (r.ok) return ((await r.json()) as { printers: string[] }).printers ?? [];
  }
  const m = /^(\d{1,3}(?:\.\d{1,3}){2})\.\d{1,3}$/.exec(location.hostname);
  if (!m) throw new Error('no-subnet');
  return (await impresionService.descubrir(m[1], 9100)).hosts.map((h) => h.ip);
}

/** Печатает документ на IP-принтере. Бросает Error с понятным кодом: 'agent+server' если не сработали оба пути. */
export async function printIp(doc: { tipo: 'recibo' | 'cuenta' | 'cocina' | 'cierre' | 'prueba'; pedidoId?: string }, p: IpPrinter): Promise<{ printer: string; via: 'agent' | 'server' }> {
  const cfg = getLocalCfg();
  const a = await probeAgent(cfg.url);
  let agentErr = '';
  if (cfg.enabled && a.online && a.allowed !== false) {
    try { const r = await printLocal(doc, { ...cfg, printer: `${p.ip}:${p.port}` }); return { printer: r.printer, via: 'agent' }; }
    catch (e) { agentErr = (e as Error).message; }
  }
  try {
    const r = await api.post<{ printer: string }>('/imprimir/ip', { ...doc, host: p.ip, puerto: p.port, ancho: cfg.ancho, codepage: cfg.codepage, lang: printLang }, { timeout: 12000 });
    return { printer: r.data.printer, via: 'server' };
  } catch (e) {
    const err = new Error(agentErr || 'server');
    (err as Error & { detail?: string }).detail = (e as { response?: { data?: { detalle?: string; error?: string } } })?.response?.data?.detalle;
    throw err;
  }
}
