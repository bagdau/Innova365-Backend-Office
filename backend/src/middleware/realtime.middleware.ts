import { Request, Response, NextFunction } from 'express';
import { emitirCambio, suscribir, presenciaEntra, presenciaSale, Canal } from '../events';
import { invalidate } from '../cache';
import { describe, registrar, nombreDe } from '../audit';

const RUTAS: Array<[string, Canal[]]> = [
  ['/pedidos',    ['pedidos', 'mesas', 'dashboard', 'inventario']],
  ['/mesas',      ['mesas', 'dashboard']],
  ['/inventario', ['inventario', 'dashboard']],
  ['/compras',    ['compras', 'inventario', 'dashboard']],
  ['/proveedores', ['compras']],
  ['/impresoras', ['impresoras']],
  ['/menu',       ['menu']],
  ['/usuarios',   ['usuarios']],
  ['/restaurante', ['usuarios']],
  ['/recetas',    ['menu', 'inventario']],
];

/**
 * Tras cada escritura:
 *  - exitosa → avisa a los clientes (SSE) y limpia cachés;
 *  - exitosa o rechazada por permisos (403) → deja constancia en el registro de actividad.
 */
export function notifyOnWrite(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') { next(); return; }
  // Снимаем описание действия и путь СЕЙЧАС: к моменту finish Express уже восстановил исходный req.url,
  // и после ошибок (403/…) относительный путь был бы другим.
  const d = describe(req);
  const path = req.path;
  res.on('finish', () => {
    if (!req.restauranteId) return;
    const ok = res.statusCode < 400;

    if (ok || res.statusCode === 403) {
      if (d && req.user) {
        void registrar({
          restauranteId: req.restauranteId, usuarioId: req.user.userId, rol: req.user.rol,
          accion: ok ? d.accion : `${d.accion}.denegado`, detalle: d.detalle, ref: d.ref,
          metodo: req.method, ruta: req.originalUrl.split('?')[0], estado: res.statusCode,
        });
      }
    }
    if (!ok) return;

    const hit = RUTAS.find(([prefix]) => path.startsWith(prefix));
    if (!hit) return;
    if (hit[0] === '/menu') invalidate(`${req.restauranteId}:menu`);
    if (hit[0] === '/pedidos') invalidate(`${req.restauranteId}:rep`);
    emitirCambio(req.restauranteId, hit[1]);
  });
  next();
}

/** GET /api/events — flujo SSE con los canales que cambiaron; además marca al usuario como «en línea». */
export function eventsHandler(req: Request, res: Response): void {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  res.write(`: ${' '.repeat(2048)}\n\n`);   // «разгон» для прокси, которые копят первые килобайты ответа в буфере
  res.write(`event: ready\ndata: {}\n\n`);

  const rid = req.restauranteId!;
  const user = req.user!;
  void nombreDe(user.userId).then((nombre) => presenciaEntra(rid, { usuarioId: user.userId, nombre, rol: user.rol }));

  const off = suscribir(rid, (canales) => {
    res.write(`event: cambio\ndata: ${JSON.stringify(canales)}\n\n`);
  });
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);

  req.on('close', () => { clearInterval(ping); off(); presenciaSale(rid, user.userId); });
}
