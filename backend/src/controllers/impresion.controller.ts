import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../idem';
import { isAdminRole } from '../roles';
import { imprimir, imprimirPrueba, estadoImpresoras, generarBytes, TipoImpresion } from '../print/print.service';
import { assertHostAllowed, listAgentPrinters, sendToPrinter } from '../print/transport';
import { olvidar } from '../print/health';
import { descubrir, comprobar, isPrivateSubnet, isPrivateHost, assertPort } from '../print/discovery';

const mask = <T extends { token: string | null }>(p: T) => ({ ...p, token: p.token ? '••••••' : null, tieneToken: !!p.token });

export async function getImpresoras(req: Request, res: Response): Promise<void> {
  const rows = await prisma.impresora.findMany({ where: { restauranteId: req.restauranteId! }, orderBy: { creadoEn: 'asc' } });
  res.json(rows.map(mask));
}

function clean(body: Record<string, unknown>) {
  const b = { ...body } as Record<string, any>;
  if (b.tipo === 'NAVEGADOR') { b.host = null; b.nombreSistema = null; b.token = null; }
  if (b.host) assertHostAllowed(String(b.host));
  if (b.token === '••••••' || b.token === '') delete b.token; // не перезаписываем скрытый токен
  return b;
}

export async function createImpresora(req: Request, res: Response): Promise<void> {
  const b = clean(req.body);
  const p = await prisma.impresora.create({ data: { ...b, restauranteId: req.restauranteId! } as any });
  res.status(201).json(mask(p));
}

export async function updateImpresora(req: Request, res: Response): Promise<void> {
  const b = clean(req.body);
  const p = await prisma.impresora.update({ where: { id: req.params.id, restauranteId: req.restauranteId! }, data: b as any });
  olvidar(p.id);
  res.json(mask(p));
}

export async function deleteImpresora(req: Request, res: Response): Promise<void> {
  await prisma.impresora.delete({ where: { id: req.params.id, restauranteId: req.restauranteId! } });
  olvidar(req.params.id);
  res.status(204).send();
}

export async function pruebaImpresora(req: Request, res: Response): Promise<void> {
  const r = await imprimirPrueba(req.restauranteId!, req.params.id, req.body?.lang === 'en' ? 'en' : 'ru', req.user!.userId);
  res.json(r);
}

/** Список принтеров Windows на ПК с агентом (для выпадающего списка в настройках). */
export async function agentePrinters(req: Request, res: Response): Promise<void> {
  const host = String(req.query.host ?? '');
  if (!host) throw new HttpError(400, 'Dirección de impresora inválida');
  let token = req.query.token ? String(req.query.token) : null;
  // токен можно взять из уже сохранённого принтера этого хоста
  if (!token || token === '••••••') {
    const saved = await prisma.impresora.findFirst({ where: { restauranteId: req.restauranteId!, host, token: { not: null } } });
    token = saved?.token ?? null;
  }
  res.json(await listAgentPrinters(host, token));
}

export async function imprimirDocumento(req: Request, res: Response): Promise<void> {
  const { tipo, pedidoId, impresoraId, lang } = req.body as { tipo: Exclude<TipoImpresion, 'prueba'>; pedidoId?: string; impresoraId?: string; lang?: 'ru' | 'en' };
  if (tipo === 'cierre' && !isAdminRole(req.user!.rol) && req.user!.rol !== 'CAJERO') throw new HttpError(403, 'Sin permisos para esta acción');
  if (tipo === 'recibo' && req.user!.rol === 'MESERO') throw new HttpError(403, 'Sin permisos para esta acción');
  const out = await imprimir({ restauranteId: req.restauranteId!, tipo, pedidoId, impresoraId, lang, usuarioId: req.user!.userId });
  res.json(out);
}

/** Короткий список для выбора принтера «этого устройства» (кассир / официант не видят настройки и токены). */
export async function getDisponibles(req: Request, res: Response): Promise<void> {
  const rows = await prisma.impresora.findMany({ where: { restauranteId: req.restauranteId!, activa: true }, orderBy: { creadoEn: 'asc' } });
  res.json(rows.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, ancho: p.ancho, usos: p.usos })));
}

/** Поиск принтеров в локальной сети: ?subred=10.206.2&puerto=9100 */
export async function descubrirImpresoras(req: Request, res: Response): Promise<void> {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})(?:\.\d{1,3})?(?:\/\d{1,2})?$/.exec(String(req.query.subred ?? '').trim());
  const subred = m ? m[1] : '';
  const puerto = Number(req.query.puerto ?? 9100);
  if (!isPrivateSubnet(subred)) throw new HttpError(400, 'Subred inválida (usa una red local, p. ej. 192.168.1)');
  assertPort(puerto);
  res.json({ subred, ...(await descubrir(subred, puerto)) });
}

/** Проверка одного адреса перед сохранением: доступен ли порт и отвечает ли устройство как принтер. */
export async function comprobarImpresora(req: Request, res: Response): Promise<void> {
  const host = String(req.body?.host ?? '').trim();
  const puerto = Number(req.body?.puerto ?? 9100);
  if (!isPrivateHost(host)) throw new HttpError(400, 'Dirección de impresora inválida');
  assertPort(puerto);
  res.json({ host, puerto, ...(await comprobar(host, puerto)) });
}

export async function getTrabajos(req: Request, res: Response): Promise<void> {
  const rows = await prisma.trabajoImpresion.findMany({
    where: { restauranteId: req.restauranteId! }, orderBy: { creadoEn: 'desc' }, take: 40,
    include: { impresora: { select: { nombre: true } } },
  });
  res.json(rows.map((r) => ({ id: r.id, tipo: r.tipo, referencia: r.referencia, ok: r.ok, error: r.error, ms: r.ms, creadoEn: r.creadoEn, impresora: r.impresora?.nombre ?? null })));
}

/** Живое состояние принтеров: онлайн/офлайн, бумага, отклик. Доступно кассиру и официанту (без адресов и токенов). */
export async function getEstado(req: Request, res: Response): Promise<void> {
  res.json(await estadoImpresoras(req.restauranteId!));
}

type Doc = { tipo?: string; pedidoId?: string; ancho?: number; codepage?: string; corte?: boolean; cajon?: boolean; lang?: string };

async function bytesDe(req: Request, b: Doc) {
  const tipo = b.tipo as Exclude<TipoImpresion, 'prueba'> | 'prueba';
  if (!['recibo', 'cuenta', 'cocina', 'cierre', 'prueba'].includes(String(tipo))) throw new HttpError(400, 'Datos inválidos');
  if (tipo === 'cierre' && !isAdminRole(req.user!.rol) && req.user!.rol !== 'CAJERO') throw new HttpError(403, 'Sin permisos para esta acción');
  if (tipo === 'recibo' && req.user!.rol === 'MESERO') throw new HttpError(403, 'Sin permisos para esta acción');
  if (['recibo', 'cuenta', 'cocina'].includes(tipo) && !b.pedidoId) throw new HttpError(400, 'Datos inválidos');
  const ancho = Math.min(120, Math.max(40, Number(b.ancho) || 80));
  const codepage = ['cp866', 'cp1251', 'ascii'].includes(String(b.codepage)) ? String(b.codepage) : 'cp866';
  return generarBytes({ restauranteId: req.restauranteId!, tipo, pedidoId: b.pedidoId, ancho, codepage, corte: b.corte !== false, cajon: !!b.cajon, lang: b.lang === 'en' ? 'en' : 'ru' });
}

/** ESC/POS-байты документа для печати через агент на ПК кассы (сервер в интернете принтер не видит). */
export async function getBytes(req: Request, res: Response): Promise<void> {
  res.json(await bytesDe(req, req.body as Doc));
}

/**
 * Печать на сетевой (IP) принтер прямо с сервера — для установки, где сервер стоит в той же сети, что и принтер.
 * Если сервер в интернете, этот путь не работает: тогда печатает агент на кассе (ретрансляция на IP).
 */
export async function imprimirIp(req: Request, res: Response): Promise<void> {
  const b = req.body as Doc & { host?: string; puerto?: number };
  const host = String(b.host ?? '').trim();
  const puerto = Number(b.puerto ?? 9100);
  if (!isPrivateHost(host)) throw new HttpError(400, 'Dirección de impresora inválida');
  if (![9100, 9101, 9102].includes(puerto)) throw new HttpError(400, 'Puerto no permitido');
  const doc = await bytesDe(req, b);
  const t0 = Date.now();
  await sendToPrinter({ id: 'ip', nombre: host, tipo: 'RED', host, puerto, nombreSistema: null, token: null, ancho: 80, codepage: 'cp866', corte: true, cajon: false, copias: 1 }, Buffer.from(doc.data, 'base64'));
  res.json({ ok: true, ms: Date.now() - t0, printer: `${host}:${puerto}` });
}
