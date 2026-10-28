import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { autoImprimir, imprimir } from '../print/print.service';
import { EstadoPedido, Prisma } from '@prisma/client';
import { HttpError } from '../idem';
import { descontarItems, devolverPedido } from '../recetas';
import { serviceCharge } from '../service-charge';
import { CURRENCIES, DEFAULT_CURRENCY, isCurrency } from '../currency';


const ESTADO_ORDEN: EstadoPedido[] = [
  'PENDIENTE', 'EN_COCINA', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'PAGADO',
];

export async function getActiveWaiters(req: Request, res: Response): Promise<void> {
  const waiters = await prisma.usuario.findMany({
    where: { restauranteId: req.restauranteId!, rol: 'MESERO', activo: true },
    select: { id: true, nombre: true, waiterPercent: true },
    orderBy: { nombre: 'asc' },
  });
  res.json(waiters);
}

export async function getPedidos(req: Request, res: Response): Promise<void> {
  const { estado, tipo, fecha_inicio, fecha_fin, q, page = '1', limit = '20' } = req.query;

  const pageNumber = Number(page);
  const pageSize = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new HttpError(400, 'Неверный номер страницы или размер страницы');
  }

  const where: any = { restauranteId: req.restauranteId! };
  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (req.user!.rol === 'REPARTIDOR') where.tipo = 'PARA_LLEVAR';
  if (q !== undefined) {
    const query = String(q).trim();
    if (query) {
      const number = Number(query);
      if (!/^\d+$/.test(query) || !Number.isSafeInteger(number) || number < 1) {
        res.json({ data: [], total: 0, page: pageNumber, limit: pageSize });
        return;
      }
      where.OR = [{ numero: number }, { mesa: { is: { numero: number } } }];
    }
  }
  if (fecha_inicio || fecha_fin) {
    where.creadoEn = {};
    if (fecha_inicio) where.creadoEn.gte = new Date(fecha_inicio as string);
    if (fecha_fin) where.creadoEn.lte = new Date(fecha_fin as string);
  }

  const skip = (pageNumber - 1) * pageSize;
  const [total, pedidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { creadoEn: 'desc' },
      include: {
        mesa: { select: { numero: true } },
        mesero: { select: { nombre: true, rol: true } },
        items: { include: { producto: { select: { nombre: true, precio: true } } } },
      },
    }),
  ]);

  res.json({ data: pedidos, total, page: pageNumber, limit: pageSize });
}

export async function getPedidosActivos(req: Request, res: Response): Promise<void> {
  const pedidos = await prisma.pedido.findMany({
    where: {
      restauranteId: req.restauranteId!,
      estado: { notIn: ['PAGADO', 'CANCELADO'] },
      ...(req.user!.rol === 'REPARTIDOR' ? { tipo: 'PARA_LLEVAR' as const } : {}),
    },
    orderBy: { creadoEn: 'asc' },
    include: {
      mesa: { select: { numero: true } },
      mesero: { select: { nombre: true, rol: true } },
      items: {
        include: {
          producto: {
            select: { nombre: true, imagen: true, requiereCocina: true },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  });
  res.json(pedidos);
}

export async function addItemsToPedido(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { items } = req.body;

  if (!items?.length) { res.status(400).json({ error: 'Items requeridos' }); return; }

  const pedido = await prisma.pedido.findFirst({
    where: { id, restauranteId: req.restauranteId! },
  });
  if (!pedido) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
  if (['PAGADO', 'CANCELADO'].includes(pedido.estado)) {
    res.status(400).json({ error: 'No se pueden añadir items a un pedido finalizado' });
    return;
  }

  const productos = await prisma.producto.findMany({
    where: { id: { in: items.map((i: any) => i.productoId) }, restauranteId: req.restauranteId! },
  });

  const itemsData = items.map((item: any) => {
    const prod = productos.find((p) => p.id === item.productoId);
    if (!prod) throw new HttpError(404, 'Producto no encontrado');
    const precio = Number(prod.precio);
    return { productoId: item.productoId, cantidad: item.cantidad, precio, subtotal: precio * item.cantidad, requiereCocina: prod.requiereCocina };
  });

  const extraTotal = itemsData.reduce((s: Prisma.Decimal, i: any) => s.plus(i.subtotal), new Prisma.Decimal(0));

  // Si algún ítem nuevo va a cocina → el pedido vuelve a EN_COCINA
  const algunoRequiereCocina = itemsData.some((i: any) => i.requiereCocina);
  const nuevoEstado = algunoRequiereCocina ? 'EN_COCINA' : undefined;

  let nuevosIds: string[] = [];
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.pedido.findFirst({ where: { id, restauranteId: req.restauranteId! } });
    if (!current || ['PAGADO', 'CANCELADO'].includes(current.estado)) throw new HttpError(409, 'El pedido ya está pagado o cancelado');
    const oldService = new Prisma.Decimal(current.serviceAmount);
    const subtotal = new Prisma.Decimal(current.total ?? 0).minus(oldService).plus(extraTotal);
    const newService = serviceCharge(subtotal, new Prisma.Decimal(current.servicePercent), current.serviceDecimals);
    const increment = extraTotal.plus(newService).minus(oldService);
    // Атомарно: пока добавляли позиции, заказ могли оплатить/отменить в другой вкладке
    const ok = await tx.pedido.updateMany({
      where: { id, restauranteId: req.restauranteId!, estado: { notIn: ['PAGADO', 'CANCELADO'] }, total: current.total, serviceAmount: current.serviceAmount },
      data: { total: { increment }, serviceAmount: newService, ...(nuevoEstado && { estado: nuevoEstado }) },
    });
    if (ok.count === 0) throw new HttpError(409, 'El pedido ya está pagado o cancelado');
    const creados = await tx.itemPedido.createManyAndReturn({
      select: { id: true, productoId: true, cantidad: true },
      data: itemsData.map((i: any) => ({
        pedidoId: id,
        productoId: i.productoId,
        cantidad: i.cantidad,
        precio: i.precio,
        subtotal: i.subtotal,
      })),
    });
    nuevosIds = creados.map((c) => c.id);
    await descontarItems(tx, req.restauranteId!, { id, numero: pedido.numero }, creados, req.user!.userId);   // расход по тех-картам
    return tx.pedido.findUniqueOrThrow({
      where: { id },
      include: {
        mesa: { select: { numero: true } },
        items: { include: { producto: { select: { nombre: true, imagen: true, requiereCocina: true } } } },
      },
    });
  });

  autoImprimir(req.restauranteId!, 'cocina', id, { usuarioId: req.user!.userId, itemIds: nuevosIds });
  res.json(updated);
}

export async function getPedidoById(req: Request, res: Response): Promise<void> {
  const pedido = await prisma.pedido.findFirst({
    where: { id: req.params.id, restauranteId: req.restauranteId! },
    include: {
      mesa: { select: { numero: true } },
      mesero: { select: { nombre: true, rol: true } },
      items: { include: { producto: true } },
    },
  });
  if (!pedido || (req.user!.rol === 'REPARTIDOR' && pedido.tipo !== 'PARA_LLEVAR')) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
  res.json(pedido);
}

export async function createPedido(req: Request, res: Response): Promise<void> {
  const { tipo, items } = req.body;
  const requestedWaiterId = req.body.meseroId as string | undefined | null;
  if (requestedWaiterId && req.user!.rol === 'MESERO' && requestedWaiterId !== req.user!.userId) throw new HttpError(403, 'Нельзя назначить другого официанта');
  const meseroId = requestedWaiterId || req.user!.userId;
  // «С собой» — без стола; «В зале» — стол обязателен
  const mesaId: string | null = tipo === 'EN_MESA' ? (req.body.mesaId || null) : null;
  if (tipo === 'EN_MESA' && !mesaId) throw new HttpError(400, 'Selecciona una mesa');

  if (!items?.length) { res.status(400).json({ error: 'Items requeridos' }); return; }

  const productos = await prisma.producto.findMany({
    where: { id: { in: items.map((i: any) => i.productoId) }, restauranteId: req.restauranteId! },
  });

  const itemsData = items.map((item: any) => {
    const prod = productos.find((p) => p.id === item.productoId);
    if (!prod) throw new HttpError(404, 'Producto no encontrado');
    const precio = Number(prod.precio);
    return {
      productoId: item.productoId,
      cantidad: item.cantidad,
      precio,
      subtotal: precio * item.cantidad,
    };
  });

  const subtotal = itemsData.reduce((s: Prisma.Decimal, i: any) => s.plus(i.subtotal), new Prisma.Decimal(0));

  // Заказ без блюд для кухни (только напитки/соусы) на кухню не идёт: сразу «Готов к подаче»,
  // иначе он навсегда застрял бы в «На кухне» — кухня его не видит, выдать и оплатить нельзя.
  const sinCocina = !items.some((it: any) => productos.find((p) => p.id === it.productoId)?.requiereCocina);

  const pedido = await prisma.$transaction(async (tx) => {
    if (mesaId) {
      const activos = await tx.pedido.count({
        where: { mesaId, estado: { notIn: ['PAGADO', 'CANCELADO'] } },
      });
      if (activos > 0) throw new HttpError(409, 'Mesa ocupada');
      // Захватываем стол до создания заказа: конкурентный официант не откроет второй заказ.
      const m = await tx.mesa.updateMany({ where: { id: mesaId, restauranteId: req.restauranteId!, estado: 'LIBRE' }, data: { estado: 'OCUPADA' } });
      if (m.count === 0) throw new HttpError(409, 'Mesa ocupada');
    }
    const restaurant = await tx.restaurante.findUnique({ where: { id: req.restauranteId! }, select: { moneda: true } });
    if (!restaurant) throw new HttpError(404, 'Ресторан не найден');
    const waiter = await tx.usuario.findFirst({
      where: { id: meseroId, restauranteId: req.restauranteId! },
      select: { rol: true, activo: true, waiterPercent: true },
    });
    if (!waiter) throw new HttpError(requestedWaiterId ? 400 : 401, requestedWaiterId ? 'Выберите действующего официанта' : 'No autenticado');
    if (requestedWaiterId && (!waiter.activo || waiter.rol !== 'MESERO')) throw new HttpError(400, 'Выберите действующего официанта');
    const servicePercent = waiter.rol === 'MESERO' ? waiter.waiterPercent : new Prisma.Decimal(0);
    const serviceDecimals = CURRENCIES[isCurrency(restaurant.moneda) ? restaurant.moneda : DEFAULT_CURRENCY];
    const serviceAmount = serviceCharge(subtotal, new Prisma.Decimal(servicePercent), serviceDecimals);
    const total = subtotal.plus(serviceAmount);
    const p = await tx.pedido.create({
      data: {
        tipo,
        mesaId: mesaId || null,
        meseroId,
        restauranteId: req.restauranteId!,
        total,
        servicePercent,
        serviceAmount,
        serviceDecimals,
        estado: sinCocina ? 'LISTO' : 'EN_COCINA',
        ...(sinCocina && { tiempoListo: new Date() }),
        items: { create: itemsData.map((i: any) => ({ ...i, servido: sinCocina })) },
      },
      include: {
        mesa: { select: { numero: true } },
        items: { include: { producto: { select: { nombre: true } } } },
      },
    });

    await descontarItems(tx, req.restauranteId!, { id: p.id, numero: p.numero }, p.items.map((i) => ({ id: i.id, productoId: i.productoId, cantidad: i.cantidad })), meseroId);   // расход по тех-картам

    return p;
  });

  if (!sinCocina) autoImprimir(req.restauranteId!, 'cocina', pedido.id, { usuarioId: req.user!.userId });
  res.status(201).json(pedido);
}

/**
 * Transiciones válidas — bloqueamos saltos hacia atrás o estados imposibles.
 * Cualquier estado puede ir a CANCELADO (excepto PAGADO).
 */
const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE:      ['EN_COCINA', 'EN_PREPARACION', 'LISTO', 'CANCELADO'],
  EN_COCINA:      ['EN_PREPARACION', 'LISTO', 'CANCELADO'],
  EN_PREPARACION: ['LISTO', 'CANCELADO'],
  LISTO:          ['ENTREGADO', 'CANCELADO'],
  ENTREGADO:      ['EN_COCINA'],   // оплата — только через /pago (способ оплаты и признак pagado)
  PAGADO:         [],
  CANCELADO:      [],
};

export async function updateEstadoPedido(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { estado } = req.body;

  if (!ESTADO_ORDEN.includes(estado) && estado !== 'CANCELADO') {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }

  const pedido = await prisma.pedido.findFirst({
    where: { id, restauranteId: req.restauranteId! },
  });
  if (!pedido) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
  // Один понятный маршрут: кухня готовит, зал/выдача вручает, касса принимает оплату отдельно.
  const rol = req.user!.rol;
  const admin = rol === 'ADMIN' || rol === 'SUPERADMIN';
  const cocina = ['EN_PREPARACION', 'LISTO'].includes(estado);
  const entregaEnMesa = estado === 'ENTREGADO' && pedido.tipo === 'EN_MESA';
  const entregaParaLlevar = estado === 'ENTREGADO' && pedido.tipo === 'PARA_LLEVAR';
  if (!admin && !(
    (cocina && rol === 'COCINERO') ||
    (entregaEnMesa && rol === 'MESERO') ||
    (entregaParaLlevar && (rol === 'REPARTIDOR' || rol === 'CAJERO'))
  )) throw new HttpError(403, 'Sin permisos para esta acción');

  // Validar transición: solo permitimos avanzar por la máquina de estados
  const permitidos = TRANSICIONES_VALIDAS[pedido.estado] ?? [];
  if (!permitidos.includes(estado)) {
    res.status(400).json({
      error: `Transición inválida: ${pedido.estado} → ${estado}. Permitidos: ${permitidos.join(', ') || 'ninguno (estado final)'}`,
    });
    return;
  }

  const updateData: any = { estado };
  if (estado === 'EN_PREPARACION') updateData.tiempoInicio = new Date();
  if (estado === 'LISTO')          updateData.tiempoListo  = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    // Захватываем текущую версию заказа до побочных действий: другая касса могла
    // оплатить, отменить или добавить позиции после чтения pedido выше.
    const moved = await tx.pedido.updateMany({
      where: { id, restauranteId: req.restauranteId!, estado: pedido.estado, actualizadoEn: pedido.actualizadoEn },
      data: updateData,
    });
    if (moved.count === 0) throw new HttpError(409, 'El pedido cambió; actualiza la página');

    // Al marcar LISTO, todos los ítems pendientes quedan como servidos
    if (estado === 'LISTO') {
      const cocinero = await tx.usuario.findFirst({
        where: { id: req.user!.userId, restauranteId: req.restauranteId! },
        select: { nombre: true },
      });
      if (!cocinero) throw new HttpError(401, 'No autenticado');
      await tx.pedido.update({
        where: { id },
        data: { cocineroId: req.user!.userId, cocineroNombre: cocinero.nombre },
      });
      await tx.itemPedido.updateMany({
        where: { pedidoId: id, servido: false },
        data: { servido: true },
      });
    }
    const p = await tx.pedido.findUniqueOrThrow({
      where: { id },
      include: { mesa: true, items: { include: { producto: true } } },
    });
    if (estado === 'CANCELADO') await devolverPedido(tx, req.restauranteId!, { id, numero: pedido.numero }, req.user!.userId);   // вернуть ингредиенты на склад
    if (estado === 'CANCELADO' && pedido.mesaId) await liberarMesa(tx, pedido.mesaId, id);
    return p;
  });

  res.json(updated);
}

/** Освобождает стол, если на нём не осталось других активных заказов. */
async function liberarMesa(tx: Prisma.TransactionClient, mesaId: string, exceptId: string) {
  const otros = await tx.pedido.count({ where: { mesaId, id: { not: exceptId }, estado: { notIn: ['PAGADO', 'CANCELADO'] } } });
  if (otros === 0) await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'LIBRE' } });
}

export async function registrarPago(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { metodoPago } = req.body;
  const expectedTotal = req.body.expectedTotal as number | undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const cajero = await tx.usuario.findFirst({
      where: { id: req.user!.userId, restauranteId: req.restauranteId! },
      select: { nombre: true, rol: true },
    });
    if (!cajero) throw new HttpError(401, 'No autenticado');
    // Атомарно: оплатить можно только активный заказ, и ровно один раз (даже при двойном клике / двух кассах)
    const r = await tx.pedido.updateMany({
      where: { id, restauranteId: req.restauranteId!, estado: 'ENTREGADO', ...(expectedTotal !== undefined ? { total: expectedTotal } : {}) },
      data: { estado: 'PAGADO', pagado: true, pagadoEn: new Date(), metodoPago, cajeroNombre: cajero.nombre, cajeroRol: cajero.rol },
    });
    if (r.count === 0) {
      const existe = await tx.pedido.findFirst({ where: { id, restauranteId: req.restauranteId! }, select: { id: true, total: true, estado: true } });
      if (existe?.estado === 'ENTREGADO' && expectedTotal !== undefined && !new Prisma.Decimal(existe.total ?? 0).equals(expectedTotal)) {
        throw new HttpError(409, 'Сумма заказа изменилась. Обновите заказ перед оплатой');
      }
      throw existe ? new HttpError(409, 'Заказ должен быть выдан гостю до оплаты или уже закрыт') : new HttpError(404, 'Pedido no encontrado');
    }
    const p = await tx.pedido.findUniqueOrThrow({ where: { id } });
    if (p.mesaId) await liberarMesa(tx, p.mesaId, id);
    return p;
  });

  // Дожидаемся результата автопечати: если ответить по таймауту, сервер может
  // допечатать чек позже, пока касса уже отправила дубликат на локальный принтер.
  const imp = await imprimir({ restauranteId: req.restauranteId!, tipo: 'recibo', pedidoId: id, soloAuto: true, usuarioId: req.user!.userId }).catch(() => null);
  const ok = imp?.resultados.find((r) => r.ok);
  res.json({ ...updated, impresion: { impreso: !!ok, impresora: ok?.impresora ?? null, intentos: imp?.resultados.length ?? 0 } });
}
