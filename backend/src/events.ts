import { EventEmitter } from 'events';

/**
 * Bus de eventos en memoria: avisa a los clientes conectados por SSE
 * (cocina, caja, meseros…) que algo cambió, sin que tengan que sondear.
 */
export type Canal =
  | 'pedidos' | 'mesas' | 'inventario' | 'compras' | 'impresoras' | 'menu' | 'usuarios' | 'dashboard'
  | 'presencia' | 'auditoria';

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function emitirCambio(restauranteId: string, canales: Canal[]) {
  bus.emit(restauranteId, canales);
}

export function suscribir(restauranteId: string, fn: (c: Canal[]) => void): () => void {
  bus.on(restauranteId, fn);
  return () => bus.off(restauranteId, fn);
}

// ───────── Присутствие: кто сейчас в системе (открыт поток событий) ─────────

export interface Presencia { usuarioId: string; nombre: string; rol: string; desde: number; conexiones: number }
const online = new Map<string, Map<string, Presencia>>();

export function presenciaEntra(restauranteId: string, u: { usuarioId: string; nombre: string; rol: string }) {
  let m = online.get(restauranteId);
  if (!m) { m = new Map(); online.set(restauranteId, m); }
  const cur = m.get(u.usuarioId);
  if (cur) { cur.conexiones++; return; }
  m.set(u.usuarioId, { ...u, desde: Date.now(), conexiones: 1 });
  emitirCambio(restauranteId, ['presencia']);
}

export function presenciaSale(restauranteId: string, usuarioId: string) {
  const m = online.get(restauranteId);
  const cur = m?.get(usuarioId);
  if (!m || !cur) return;
  cur.conexiones = Math.max(0, cur.conexiones - 1);
  if (cur.conexiones > 0) return;
  // небольшая задержка: при переподключении сотрудник не «мигает» офлайном
  setTimeout(() => {
    const again = m.get(usuarioId);
    if (again && again.conexiones === 0) { m.delete(usuarioId); emitirCambio(restauranteId, ['presencia']); }
  }, 8000);
}

export function listarPresencia(restauranteId: string): Presencia[] {
  return [...(online.get(restauranteId)?.values() ?? [])].sort((a, b) => a.desde - b.desde);
}
