import { prisma } from '../prisma';
import { HttpError } from '../idem';
import { Codepage } from './escpos';
import { receiptDoc, kitchenDoc, closingDoc, testDoc, PedidoPrint, Restaurante } from './templates';
import { sendToPrinter, PrinterCfg } from './transport';
import { recordar, puntaje, salud } from './health';
import { loadCashReport, type CashReportPeriod } from './cash-report';

export type TipoImpresion = 'recibo' | 'cuenta' | 'cocina' | 'cierre' | 'prueba';

const USO: Record<Exclude<TipoImpresion, 'prueba'>, string> = { recibo: 'RECIBO', cuenta: 'CUENTA', cocina: 'COCINA', cierre: 'REPORTE' };

export interface ResultadoImpresion {
  impresoraId: string; impresora: string; ok: boolean; ms: number; error?: string; detalle?: string;
}

const num = (v: unknown) => Number(v ?? 0);

function cfgOf(p: { id: string; nombre: string; tipo: string; host: string | null; puerto: number | null; nombreSistema: string | null; token: string | null; ancho: number; codepage: string; corte: boolean; cajon: boolean; copias: number }): PrinterCfg {
  return { ...p, tipo: p.tipo as PrinterCfg['tipo'] };
}

function optsOf(p: PrinterCfg, lang: 'ru' | 'en') {
  const ancho = p.ancho === 80 && /XP[-\s]?76/i.test(`${p.nombre} ${p.nombreSistema ?? ''}`) ? 76 : p.ancho;
  return { cols: ancho <= 58 ? 32 : ancho <= 76 ? 33 : ancho <= 80 ? 48 : 56, cp: (['cp866', 'cp1251', 'ascii'].includes(p.codepage) ? p.codepage : 'cp866') as Codepage, lang, cut: p.corte, drawer: p.cajon };
}

async function loadPedido(restauranteId: string, id: string): Promise<{ p: PedidoPrint; r: Restaurante }> {
  const [pedido, r] = await Promise.all([
    prisma.pedido.findFirst({
      where: { id, restauranteId },
      include: {
        mesa: { select: { numero: true } },
        mesero: { select: { nombre: true } },
        items: { orderBy: { id: 'asc' }, include: { producto: { select: { nombre: true, requiereCocina: true } } } },
      },
    }),
    prisma.restaurante.findUniqueOrThrow({ where: { id: restauranteId } }),
  ]);
  if (!pedido) throw new HttpError(404, 'Pedido no encontrado');
  return {
    r,
    p: {
      numero: pedido.numero, tipo: pedido.tipo, estado: pedido.estado, metodoPago: pedido.metodoPago, total: pedido.total === null ? null : num(pedido.total),
      servicePercent: num(pedido.servicePercent), serviceAmount: num(pedido.serviceAmount), pagadoEn: pedido.pagadoEn,
      creadoEn: pedido.creadoEn, actualizadoEn: pedido.actualizadoEn, mesa: pedido.mesa, mesero: pedido.mesero,
      cajeroNombre: pedido.cajeroNombre, cajeroRol: pedido.cajeroRol,
      items: pedido.items.map((i) => ({ id: i.id, cantidad: i.cantidad, precio: num(i.precio), subtotal: num(i.subtotal), servido: i.servido, producto: i.producto })),
    },
  };
}

function repeat(buf: Buffer, n: number): Buffer {
  return n <= 1 ? buf : Buffer.concat(Array.from({ length: n }, () => buf));
}

async function buildDoc(tipo: TipoImpresion, p: PrinterCfg, restauranteId: string, pedidoId: string | undefined, lang: 'ru' | 'en', itemIds?: string[], periodo?: CashReportPeriod): Promise<Buffer> {
  const o = optsOf(p, lang);
  if (tipo === 'prueba') return testDoc(p.nombre, p.ancho, o.cp, o);
  if (tipo === 'cierre') {
    const [c, r] = await Promise.all([loadCashReport(restauranteId, periodo), prisma.restaurante.findUniqueOrThrow({ where: { id: restauranteId } })]);
    return closingDoc(r, c, o);
  }
  if (!pedidoId) throw new HttpError(400, 'Datos inválidos');
  const { p: pedido, r } = await loadPedido(restauranteId, pedidoId);
  if (tipo === 'cocina') return kitchenDoc(pedido, o, itemIds);
  return receiptDoc(r, pedido, o, tipo, pedidoId);
}

/**
 * Готовые байты ESC/POS для печати «на стороне кассы»: браузер получает их и отдаёт локальному агенту на своём ПК.
 * Нужно, когда сервер стоит в интернете и не видит принтер в сети кассы.
 */
export async function generarBytes(args: {
  restauranteId: string; tipo: Exclude<TipoImpresion, 'prueba'> | 'prueba'; pedidoId?: string; ancho: number; codepage: string; corte: boolean; cajon: boolean; lang?: 'ru' | 'en'; periodo?: CashReportPeriod;
}): Promise<{ data: string; bytes: number }> {
  const cfg: PrinterCfg = { id: 'local', nombre: 'Local', tipo: 'RED', host: null, puerto: null, nombreSistema: null, token: null, ancho: args.ancho, codepage: args.codepage, corte: args.corte, cajon: args.cajon, copias: 1 };
  const doc = await buildDoc(args.tipo, cfg, args.restauranteId, args.pedidoId, args.lang ?? 'ru', undefined, args.periodo);
  return { data: doc.toString('base64'), bytes: doc.length };
}

/** Печатает документ на подходящие принтеры. fallback=true — нужно печатать через браузер. */
export async function imprimir(args: {
  restauranteId: string; tipo: Exclude<TipoImpresion, 'prueba'>; pedidoId?: string; impresoraId?: string; lang?: 'ru' | 'en'; usuarioId?: string; itemIds?: string[]; soloAuto?: boolean; periodo?: CashReportPeriod;
}): Promise<{ resultados: ResultadoImpresion[]; fallback: boolean; ancho: number }> {
  const { restauranteId, tipo, pedidoId, impresoraId, usuarioId, itemIds, soloAuto } = args;
  const lang = args.lang ?? 'ru';

  const printers = await prisma.impresora.findMany({
    where: {
      restauranteId, activa: true,
      ...(impresoraId ? { id: impresoraId } : { usos: { has: USO[tipo] } }),
      ...(soloAuto ? { auto: true } : {}),
    },
  });
  const fisicas = printers.filter((p) => p.tipo !== 'NAVEGADOR');
  // ширина рулона для печати через браузер: берём из принтера «Браузер» (если настроен) или из любого чекового
  const anchoNav = (printers.find((p) => p.tipo === 'NAVEGADOR') ?? printers[0])?.ancho ?? 80;
  if (fisicas.length === 0) return { resultados: [], fallback: !soloAuto, ancho: anchoNav };

  // «Умный» выбор: один документ → один принтер. Рабочие и быстрые первыми; если принтер не ответил — сразу следующий (failover).
  // Явно выбранный принтер (impresoraId) — только он.
  if (!impresoraId && fisicas.length > 1) await Promise.all(fisicas.map((p) => salud(p, 1000).catch(() => undefined))); // мгновенная проверка: мёртвые — в конец
  const ordenados = impresoraId ? fisicas : [...fisicas].sort((a, b) => puntaje(a.id) - puntaje(b.id));
  const resultados: ResultadoImpresion[] = [];
  for (const row of ordenados) {
    const cfg = cfgOf(row);
    const t0 = Date.now();
    try {
      const doc = await buildDoc(tipo, cfg, restauranteId, pedidoId, lang, itemIds, args.periodo);
      await sendToPrinter(cfg, repeat(doc, tipo === 'cocina' ? 1 : cfg.copias));
      const ms = Date.now() - t0;
      recordar(row.id, true, ms);
      await prisma.trabajoImpresion.create({ data: { restauranteId, impresoraId: row.id, tipo, referencia: pedidoId ?? null, ok: true, ms, usuarioId } });
      resultados.push({ impresoraId: row.id, impresora: row.nombre, ok: true, ms });
      break;
    } catch (e) {
      const ms = Date.now() - t0;
      const detalle = (e as { detalle?: string }).detalle ?? (e as Error).message;
      recordar(row.id, false, ms);
      await prisma.trabajoImpresion.create({ data: { restauranteId, impresoraId: row.id, tipo, referencia: pedidoId ?? null, ok: false, error: String(detalle).slice(0, 300), ms, usuarioId } }).catch(() => undefined);
      resultados.push({ impresoraId: row.id, impresora: row.nombre, ok: false, ms, error: 'No se pudo imprimir', detalle: String(detalle).slice(0, 200) });
    }
  }

  // если всё упало — клиент может предложить печать через браузер
  return { resultados, fallback: !soloAuto && !resultados.some((r) => r.ok), ancho: anchoNav };
}

export async function imprimirPrueba(restauranteId: string, impresoraId: string, lang: 'ru' | 'en', usuarioId?: string): Promise<ResultadoImpresion> {
  const row = await prisma.impresora.findFirst({ where: { id: impresoraId, restauranteId } });
  if (!row) throw new HttpError(404, 'Registro no encontrado');
  if (row.tipo === 'NAVEGADOR') throw new HttpError(409, 'Esta impresora imprime desde el navegador');
  const cfg = cfgOf(row);
  const t0 = Date.now();
  try {
    await sendToPrinter(cfg, await buildDoc('prueba', cfg, restauranteId, undefined, lang));
    const ms = Date.now() - t0;
    await prisma.trabajoImpresion.create({ data: { restauranteId, impresoraId, tipo: 'prueba', ok: true, ms, usuarioId } });
    return { impresoraId, impresora: row.nombre, ok: true, ms };
  } catch (e) {
    const ms = Date.now() - t0;
    const detalle = (e as { detalle?: string }).detalle ?? (e as Error).message;
    await prisma.trabajoImpresion.create({ data: { restauranteId, impresoraId, tipo: 'prueba', ok: false, error: String(detalle).slice(0, 300), ms, usuarioId } });
    return { impresoraId, impresora: row.nombre, ok: false, ms, error: 'No se pudo imprimir', detalle: String(detalle).slice(0, 200) };
  }
}

/** Автопечать (чек после оплаты, тикет кухни) — не блокирует ответ клиенту и не бросает ошибки. */
export function autoImprimir(restauranteId: string, tipo: 'recibo' | 'cocina', pedidoId: string, opts: { usuarioId?: string; itemIds?: string[] } = {}) {
  imprimir({ restauranteId, tipo, pedidoId, soloAuto: true, ...opts }).catch((e) => console.error('[autoImprimir]', e));
}


export interface EstacionDoc { impresoraId: string; impresora: string; host: string | null; puerto: number; ancho: number; items: number; data: string }

/**
 * Тикеты станций к чеку: позиции заказа группируются по принтеру категории (Categoria.impresoraId),
 * для каждого принтера — готовые байты ESC/POS. Печатает их агент на кассе (сервер в интернете сеть кассы не видит).
 * Категории без принтера и неактивные принтеры пропускаются.
 */
export async function estacionesBytes(restauranteId: string, pedidoId: string, lang: 'ru' | 'en' = 'ru'): Promise<EstacionDoc[]> {
  const { p: pedido } = await loadPedido(restauranteId, pedidoId);
  const rows = await prisma.itemPedido.findMany({
    where: { pedidoId, pedido: { restauranteId } },
    select: { id: true, producto: { select: { categoria: { select: { impresora: true } } } } },
  });
  const groups = new Map<string, { row: NonNullable<(typeof rows)[number]['producto']['categoria']['impresora']>; ids: string[] }>();
  for (const it of rows) {
    const imp = it.producto.categoria.impresora;
    if (!imp || !imp.activa || imp.tipo === 'NAVEGADOR') continue;
    const g = groups.get(imp.id) ?? { row: imp, ids: [] };
    g.ids.push(it.id); groups.set(imp.id, g);
  }
  return [...groups.values()].map(({ row, ids }) => {
    const cfg = cfgOf(row);
    const doc = kitchenDoc(pedido, optsOf(cfg, lang), ids, { title: row.nombre });
    return { impresoraId: row.id, impresora: row.nombre, host: row.host, puerto: row.puerto ?? 9100, ancho: row.ancho, items: ids.length, data: repeat(doc, 1).toString('base64') };
  });
}

/** Состояние всех активных принтеров (для окна печати: зелёная/красная точка и автоподбор). */
export async function estadoImpresoras(restauranteId: string) {
  const rows = await prisma.impresora.findMany({ where: { restauranteId, activa: true }, orderBy: { creadoEn: 'asc' } });
  return Promise.all(rows.map(async (p) => {
    const s = await salud(p);
    return { id: p.id, nombre: p.nombre, tipo: p.tipo, ancho: p.ancho, usos: p.usos, auto: p.auto, online: s.online, ms: s.ms, papel: s.papel ?? null, detalle: s.detalle ?? null };
  }));
}
