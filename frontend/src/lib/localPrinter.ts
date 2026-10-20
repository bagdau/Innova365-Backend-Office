import { api } from '../services/api';
import { printLang } from '../i18n';

/**
 * Печать «родными» командами ESC/POS через агент на ЭТОМ компьютере (127.0.0.1:9101).
 * Сервер Innova365 может стоять в интернете и не видеть принтер кассы — поэтому байты чека берём у сервера,
 * а в принтер их отправляет сам браузер кассы через локальный агент (print-agent). Чёткий текст, правильная ширина, QR и обрезка.
 */
const KEY = 'innova365-local-printer';

export interface LocalCfg {
  enabled: boolean;
  url: string;
  /** 'auto' | имя принтера Windows | IP[:порт] сетевого принтера (агент ретранслирует на порт 9100) */
  printer: string;
  ancho: number;
  codepage: 'cp866' | 'cp1251' | 'ascii';
}

export const DEFAULT_LOCAL: LocalCfg = { enabled: true, url: 'http://127.0.0.1:9101', printer: 'auto', ancho: 80, codepage: 'cp866' };

export function getLocalCfg(): LocalCfg {
  try { return { ...DEFAULT_LOCAL, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<LocalCfg>) }; } catch { return DEFAULT_LOCAL; }
}
export function setLocalCfg(patch: Partial<LocalCfg>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...getLocalCfg(), ...patch })); } catch { /* ignore */ }
  window.dispatchEvent(new Event('innova:localprinter'));
}

export interface AgentInfo { online: boolean; ms: number; host?: string; version?: string; allowed?: boolean }

/** Быстрая проверка: запущен ли агент на этом компьютере и разрешена ли ему эта страница. */
export async function probeAgent(url = getLocalCfg().url): Promise<AgentInfo> {
  const t0 = Date.now();
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(1200) });
    if (!r.ok) return { online: false, ms: Date.now() - t0 };
    const j = (await r.json()) as { host?: string; version?: string; origin?: boolean; agent?: string };
    return { online: j.agent === 'innova365', ms: Date.now() - t0, host: j.host, version: j.version, allowed: !!j.origin };
  } catch { return { online: false, ms: Date.now() - t0 }; }
}

export interface AgentPrinter { name: string; port: string; isDefault: boolean; offline: boolean; usb: boolean; thermal: boolean; score: number }
export async function agentPrinters(url = getLocalCfg().url): Promise<AgentPrinter[]> {
  const r = await fetch(`${url.replace(/\/+$/, '')}/printers`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(r.status === 401 ? 'agent: page not allowed (allowed-origins.txt)' : `agent ${r.status}`);
  return (await r.json()) as AgentPrinter[];
}

const b64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Печатает документ на принтере этого компьютера. Бросает Error с понятным текстом при сбое. */
export async function printLocal(doc: { tipo: 'recibo' | 'cuenta' | 'cocina' | 'cierre' | 'prueba'; pedidoId?: string }, cfg: LocalCfg = getLocalCfg()): Promise<{ printer: string; ms: number }> {
  const { data: doc64 } = await api.post<{ data: string }>('/imprimir/bytes', { ...doc, ancho: cfg.ancho, codepage: cfg.codepage, lang: printLang }, { timeout: 10000 });
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/.exec(cfg.printer.trim());
  const q = m ? `host=${m[1]}&port=${m[2] ?? 9100}` : `printer=${encodeURIComponent(cfg.printer.trim() || 'auto')}`;
  let res: Response;
  try {
    res = await fetch(`${cfg.url.replace(/\/+$/, '')}/print?${q}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: b64ToBytes(doc64.data) as BodyInit, signal: AbortSignal.timeout(12000) });
  } catch { throw new Error('agent unreachable'); }
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `agent ${res.status}`);
  const j = (await res.json()) as { printer?: string; ms?: number };
  return { printer: j.printer ?? cfg.printer, ms: j.ms ?? 0 };
}
