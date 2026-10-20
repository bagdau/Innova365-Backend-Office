import net from 'net';
import { probeEstado } from './discovery';
import { agentBase, assertHostAllowed } from './transport';

/** Результат проверки принтера «прямо сейчас». */
export interface Salud {
  online: boolean;
  ms: number;
  detalle?: string;
  papel?: 'ok' | 'poco' | 'sin';
  /** для агента: найденное имя принтера Windows (если задано «Авто») */
  sistema?: string;
}

interface Row { id: string; tipo: string; host: string | null; puerto: number | null; nombreSistema: string | null; token: string | null }

/** Память о последних результатах (печать и проверки) — по ней «умный выбор» ставит живые принтеры первыми. */
const memoria = new Map<string, { ok: boolean; at: number; ms: number }>();
const cache = new Map<string, { at: number; v: Salud }>();

export function recordar(id: string, ok: boolean, ms: number) { memoria.set(id, { ok, at: Date.now(), ms }); cache.delete(id); }
export function olvidar(id: string) { memoria.delete(id); cache.delete(id); }

/** Оценка для сортировки (меньше — лучше): рабочие недавно → неизвестные → недавно упавшие. */
export function puntaje(id: string): number {
  const m = memoria.get(id);
  if (!m) return 1000;
  const age = Date.now() - m.at;
  if (m.ok) return Math.min(m.ms, 900);                // быстрые первыми
  return age < 60_000 ? 5000 : 2000;                    // упавший только что — в конец, через минуту снова пробуем
}

function tcp(host: string, port: number, timeout: number): Promise<number | null> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const s = net.connect({ host, port });
    const done = (ok: boolean) => { s.destroy(); resolve(ok ? Date.now() - t0 : null); };
    s.setTimeout(timeout, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

async function agenteSalud(r: Row, timeout: number): Promise<Salud> {
  const base = agentBase(r.host!).replace(/\/+$/, '');
  const t0 = Date.now();
  try {
    const h = await fetch(`${base}/health`, { signal: AbortSignal.timeout(timeout) });
    if (!h.ok) return { online: false, ms: Date.now() - t0, detalle: `agent ${h.status}` };
    const hdr: Record<string, string> = r.token ? { 'X-Token': r.token } : {};
    const wanted = (r.nombreSistema ?? '').trim();
    const res = await fetch(`${base}/printers`, { headers: hdr, signal: AbortSignal.timeout(timeout) });
    if (res.status === 401) return { online: false, ms: Date.now() - t0, detalle: 'bad token' };
    if (!res.ok) return { online: true, ms: Date.now() - t0 };
    const list = (await res.json()) as Array<{ name: string; offline?: boolean }>;
    const found = !wanted || wanted.toLowerCase() === 'auto' ? list.find((p) => !p.offline) : list.find((p) => p.name === wanted);
    if (!found) return { online: false, ms: Date.now() - t0, detalle: wanted ? `printer "${wanted}" not found` : 'no printers' };
    if (found.offline) return { online: false, ms: Date.now() - t0, detalle: 'printer offline', sistema: found.name };
    return { online: true, ms: Date.now() - t0, sistema: found.name };
  } catch (e) {
    return { online: false, ms: Date.now() - t0, detalle: (e as Error).message };
  }
}

/** Быстрая проверка одного принтера (кэш 6 с, чтобы окна печати на нескольких кассах не создавали нагрузку). */
export async function salud(r: Row, timeout = 1200): Promise<Salud> {
  const c = cache.get(r.id);
  if (c && Date.now() - c.at < 6000) return c.v;
  let v: Salud;
  if (r.tipo === 'NAVEGADOR') v = { online: true, ms: 0 };
  else if (!r.host) v = { online: false, ms: 0, detalle: 'no address' };
  else {
    try { assertHostAllowed(r.host); } catch { return { online: false, ms: 0, detalle: 'bad address' }; }
    if (r.tipo === 'AGENTE') v = await agenteSalud(r, timeout);
    else {
      const host = r.host.replace(/^https?:\/\//, '');
      const ms = await tcp(host, r.puerto ?? 9100, timeout);
      if (ms === null) v = { online: false, ms: timeout, detalle: 'no connection' };
      else {
        const e = await probeEstado(host, r.puerto ?? 9100, 700);
        v = { online: e.escpos ? e.enLinea !== false : true, ms, papel: e.papel, detalle: e.escpos && e.enLinea === false ? 'printer offline' : undefined };
      }
    }
  }
  cache.set(r.id, { at: Date.now(), v });
  if (r.tipo !== 'NAVEGADOR') memoria.set(r.id, { ok: v.online, at: Date.now(), ms: v.ms });
  return v;
}
