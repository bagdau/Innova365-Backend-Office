import net from 'net';
import { HttpError } from '../idem';

export interface PrinterCfg {
  id: string;
  nombre: string;
  tipo: 'RED' | 'AGENTE' | 'NAVEGADOR';
  host: string | null;
  puerto: number | null;
  nombreSistema: string | null;
  token: string | null;
  ancho: number;
  codepage: string;
  corte: boolean;
  cajon: boolean;
  copias: number;
}

/** Не даём серверу ходить на служебные адреса облачных метаданных / loopback контейнера. */
export function assertHostAllowed(host: string) {
  const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/:]/)[0];
  if (!h) throw new HttpError(400, 'Dirección de impresora inválida');
  if (/^169\.254\./.test(h) || h === '0.0.0.0' || h === 'metadata.google.internal') throw new HttpError(400, 'Dirección de impresora inválida');
}

/** Печать по сети: сырые байты ESC/POS на порт 9100 (RAW / JetDirect). */
function sendNet(host: string, port: number, data: Buffer, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };
    socket.setTimeout(timeoutMs, () => finish(new Error('timeout')));
    socket.once('error', (e) => finish(e));
    socket.once('connect', () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        // дожидаемся отправки буфера и закрываем соединение
        socket.end(() => setTimeout(() => finish(), 150));
      });
    });
  });
}

const THERMAL = /(pos|xprinter|xp-|receipt|thermal|чек|tm-|rp-?\d|bixolon|star|citizen|sam4s|rongta|gprinter|zjiang|\b(58|80)\s?mm)/i;
const NOT_RECEIPT = /(pdf|xps|onenote|fax|microsoft|anydesk|virtual|send to)/i;

/** «Умный» выбор принтера на ПК с агентом: подключён и не офлайн → USB-порт → название чекового принтера → принтер по умолчанию. */
export function elegirMejor(list: Array<{ name: string; port?: string; offline?: boolean; isDefault?: boolean }>): string | null {
  const ok = list.filter((p) => !p.offline && !NOT_RECEIPT.test(p.name) && (THERMAL.test(p.name) || /(generic|text only)/i.test(p.name)));
  const score = (p: (typeof ok)[number]) => (THERMAL.test(p.name) ? 4 : 0) + (/^USB|^COM|^LPT|^IP_|^192|^10\./i.test(p.port ?? '') ? 2 : 0) + (p.isDefault ? 1 : 0);
  return ok.sort((a, b) => score(b) - score(a))[0]?.name ?? null;
}

/** Печать через агент на ПК с принтером (USB / драйвер Windows). Пустое имя или «auto» — агент сам найдёт принтер. */
async function sendAgent(base: string, printerName: string, token: string | null, data: Buffer): Promise<void> {
  if (!printerName.trim() || printerName.trim().toLowerCase() === 'auto') {
    const res = await fetch(`${base.replace(/\/+$/, '')}/printers`, { headers: token ? { 'X-Token': token } : {}, signal: AbortSignal.timeout(5_000) });
    if (res.status === 401) throw new Error('bad token');
    const best = res.ok ? elegirMejor((await res.json()) as never) : null;
    if (!best) throw new Error('no printer found on the agent PC');
    printerName = best;
  }
  const url = `${base.replace(/\/+$/, '')}/print?printer=${encodeURIComponent(printerName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...(token ? { 'X-Token': token } : {}) },
    body: new Uint8Array(data),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `agent ${res.status}`);
  }
}

export function agentBase(host: string): string {
  return /^https?:\/\//i.test(host) ? host : `http://${host}`;
}

export async function listAgentPrinters(host: string, token: string | null): Promise<unknown> {
  assertHostAllowed(host);
  const res = await fetch(`${agentBase(host).replace(/\/+$/, '')}/printers`, {
    headers: token ? { 'X-Token': token } : {},
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 401) throw new HttpError(401, 'Token del agente incorrecto');
  if (!res.ok) throw new HttpError(502, 'El agente de impresión no respondió');
  return res.json();
}

export async function sendToPrinter(p: PrinterCfg, data: Buffer): Promise<void> {
  if (p.tipo === 'NAVEGADOR') throw new HttpError(409, 'Esta impresora imprime desde el navegador');
  if (!p.host) throw new HttpError(400, 'Dirección de impresora inválida');
  assertHostAllowed(p.host);
  try {
    if (p.tipo === 'RED') await sendNet(p.host.replace(/^https?:\/\//, ''), p.puerto ?? 9100, data);
    else await sendAgent(agentBase(p.host), p.nombreSistema ?? '', p.token, data);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    // детали для администратора; фронтенд показывает общий перевод
    const err = new HttpError(502, 'No se pudo imprimir');
    (err as HttpError & { detalle?: string }).detalle = msg;
    throw err;
  }
}
