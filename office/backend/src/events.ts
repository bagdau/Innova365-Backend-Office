import { Client } from 'pg';
import type { Request, Response } from 'express';
import { config } from './config';
import { bumpData } from './cache';
import { resetPerms } from './perms';

/**
 * Поток событий Office (SSE). Источник — уведомления PostgreSQL (NOTIFY innova_change): их шлют триггеры при любом
 * изменении заказов, меню, склада, сотрудников и данных самого Office — из кассы, из Office или из SQL-консоли.
 * Экран получает сигнал «что-то изменилось» и тихо перечитывает данные: касса → Office обычно за 50–150 мс.
 */
type Canal = 'sales' | 'menu' | 'stock' | 'staff' | 'office' | 'settings';

const PUBLIC: Record<string, Canal[]> = {
  Pedido: ['sales'], ItemPedido: ['sales'], Mesa: ['sales'],
  Producto: ['menu'], Categoria: ['menu'], Receta: ['menu'], RecetaItem: ['menu'],
  Insumo: ['stock', 'menu'], MovimientoInventario: ['stock'], Compra: ['stock'], CompraItem: ['stock'], Recepcion: ['stock'], Proveedor: ['stock'],
  Usuario: ['staff'], Restaurante: ['settings'],
};

interface Sub { rid: string; res: Response }
const subs = new Set<Sub>();
const pending = new Map<string, Set<Canal>>();   // restauranteId ('' = все) → каналы
let timer: ReturnType<typeof setTimeout> | undefined;

function flush(): void {
  timer = undefined;
  const batch = [...pending];
  pending.clear();
  for (const [rid, set] of batch) {
    const data = `event: change\ndata: ${JSON.stringify([...set])}\n\n`;
    for (const s of subs) if (!rid || s.rid === rid) s.res.write(data);
  }
}

function onNotify(payload: string | undefined): void {
  if (!payload) return;
  let m: { s: string; t: string; r: string | null };
  try { m = JSON.parse(payload); } catch { return; }
  bumpData();   // данные изменились — кэш отчётов недействителен
  if (m.s === 'office' && m.t === 'role_perm') resetPerms();
  const canales = m.s === 'office' ? (['office'] as Canal[]) : PUBLIC[m.t];
  if (!canales) return;
  const rid = m.r ?? '';
  let set = pending.get(rid);
  if (!set) { set = new Set(); pending.set(rid, set); }
  canales.forEach((c) => set!.add(c));
  if (!timer) timer = setTimeout(flush, 30);   // склеиваем всплеск уведомлений одной транзакции
}

let listening = false;
export const liveState = () => ({ listening, clients: subs.size });

export function startListener(): void {
  let retry = 500;
  const connect = async (): Promise<void> => {
    const c = new Client({ connectionString: config.databaseUrl, application_name: 'innova-office-listen', keepAlive: true });
    let dead = false;
    const again = () => {
      listening = false;
      if (dead) return;
      dead = true;
      c.removeAllListeners();
      c.end().catch(() => undefined);
      setTimeout(() => void connect(), retry);
      retry = Math.min(retry * 2, 10_000);
    };
    c.on('error', again);
    c.on('end', again);
    c.on('notification', (n) => onNotify(n.payload));
    try {
      await c.connect();
      await c.query('LISTEN innova_change');
      listening = true;
      retry = 500;
      for (const s of subs) s.res.write('event: change\ndata: ["resync"]\n\n');   // после обрыва могли пропустить события
      console.log('[events] слушаю innova_change');
    } catch (e) { console.error('[events]', (e as Error).message); again(); }
  };
  void connect();
}

/** GET /api/events (после auth). */
export function eventsHandler(req: Request, res: Response): void {
  res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  res.write(`: ${' '.repeat(2048)}\n\n`);   // «разгон» для прокси, которые копят первые килобайты ответа в буфере
  res.write('event: ready\ndata: {}\n\n');
  const sub: Sub = { rid: req.me!.rid, res };
  subs.add(sub);
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
  req.on('close', () => { clearInterval(ping); subs.delete(sub); });
}
