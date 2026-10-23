import { Client } from 'pg';
import { emitirCambio, emitirATodos, Canal } from './events';
import { invalidate } from './cache';

/**
 * Мост PostgreSQL → SSE. Триггеры в БД шлют NOTIFY innova_change при любом изменении ключевых таблиц —
 * неважно, кто изменил: касса, Innova Office или SQL-консоль. Здесь это превращается в события для экранов кассы.
 * Благодаря этому изменения из Office видны на кухне и в зале за доли секунды.
 */
const CANALES: Record<string, Canal[]> = {
  Pedido: ['pedidos', 'mesas', 'dashboard', 'inventario'],
  ItemPedido: ['pedidos', 'dashboard'],
  Mesa: ['mesas', 'dashboard'],
  Producto: ['menu'], Categoria: ['menu'],
  Receta: ['menu', 'inventario'], RecetaItem: ['menu', 'inventario'],
  Insumo: ['inventario', 'dashboard'], MovimientoInventario: ['inventario', 'dashboard'],
  Compra: ['compras', 'inventario'], CompraItem: ['compras'], Recepcion: ['compras', 'inventario'], Proveedor: ['compras'],
  Usuario: ['usuarios'], Restaurante: ['usuarios'],
  Impresora: ['impresoras'],
};
const OFFICE: Record<string, Canal[]> = { tc_state: ['menu'], tc_version: ['menu'] };

const pending = new Map<string, Set<Canal>>();   // restauranteId ('' = все) → каналы
let timer: ReturnType<typeof setTimeout> | undefined;

function flush(): void {
  timer = undefined;
  const batch = [...pending];
  pending.clear();
  for (const [rid, set] of batch) {
    const canales = [...set];
    if (canales.includes('menu')) invalidate(`${rid}:menu`);
    if (canales.includes('pedidos')) invalidate(`${rid}:rep`);
    if (rid) emitirCambio(rid, canales); else emitirATodos(canales);
  }
}

function onNotify(payload: string | undefined): void {
  if (!payload) return;
  let m: { s: string; t: string; r: string | null };
  try { m = JSON.parse(payload); } catch { return; }
  const canales = (m.s === 'office' ? OFFICE : CANALES)[m.t];
  if (!canales) return;
  const rid = m.r ?? '';
  let set = pending.get(rid);
  if (!set) { set = new Set(); pending.set(rid, set); }
  canales.forEach((c) => set!.add(c));
  if (!timer) timer = setTimeout(flush, 25);   // склеиваем всплеск уведомлений одной транзакции
}

/** Строка подключения без параметров Prisma (connection_limit и т.п.), которые pg не понимает. */
const cleanUrl = (u: string) => u.split('?')[0];

export function startDbNotify(): void {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  let retry = 500;
  const connect = async (): Promise<void> => {
    const c = new Client({ connectionString: cleanUrl(url), application_name: 'innova-kassa-listen', keepAlive: true });
    let dead = false;
    const again = () => {
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
      retry = 500;
      // после (пере)подключения могли пропустить события — просим экраны обновиться
      pending.set('', new Set<Canal>(['pedidos', 'mesas', 'inventario', 'menu', 'usuarios', 'dashboard']));
      if (!timer) timer = setTimeout(flush, 25);
      console.log('[dbnotify] слушаю innova_change');
    } catch (e) {
      console.error('[dbnotify]', (e as Error).message);
      again();
    }
  };
  void connect();
}
