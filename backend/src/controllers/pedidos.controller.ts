import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { autoImprimir, imprimir } from '../print/print.service';
import { EstadoPedido, Prisma } from '@prisma/client';
import { HttpError } from '../idem';
import { descontarItems, devolverPedido } from '../recetas';


const ESTADO_ORDEN: EstadoPedido[] = [
  'PENDIENTE', 'EN_COCINA', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'PAGADO',
];

export async function getPedidos(req: Request, res: Response): Promise<void> {
  const { estado, tipo, fecha_inicio, fecha_fin, page = '1', limit = '20' } = req.query;

  const where: any = { restauranteId: req.restauranteId! };
  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (req.user!.rol === 'REPARTIDOR') where.tipo = 'PARA_LLEVAR';
  if (fecha_inicio || fecha_fin) {
    where.creadoEn = {};
    if (fecha_inicio) where.creadoEn.gte = new Date(fecha_inicio as string);
    if (fecha_fin) where.creadoEn.lte = new Date(fecha_fin as string);
  }

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const [total, pedidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      skip,
      take: parseInt(limit as string),
      orderBy: { creadoEn: 'desc' },
      include: {
        mesa: { select: { numero: true } },
        mesero: { select: { nombre: true } },
        items: { include: { producto: { select: { nombre: true, precio: true } } } },
      },
    }),
  ]);

  res.json({ data: pedidos, total, page: parseInt(page as string), limit: parseInt(limit as string) });
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
      mesero: { select: { nombre: true } },
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

  const extraTotal = itemsData.reduce((s: number, i: any) => s + i.subtotal, 0);

  // Si algún ítem nuevo va a cocina → el pedido vuelve a EN_COCINA
  const algunoRequiereCocina = itemsData.some((i: any) => i.requiereCocina);
  const nuevoEstado = algunoRequiereCocina ? 'EN_COCINA' : undefined;

  let nuevosIds: string[] = [];
  const updated = await prisma.$transaction(async (tx) => {
    // Атомарно: пока добавляли позиции, заказ могли оплатить/отменить в другой вкладке
    const ok = await tx.pedido.updateMany({
      where: { id, restauranteId: req.restauranteId!, estado: { notIn: ['PAGADO', 'CANCELADO'] } },
      data: { total: { increment: extraTotal }, ...(nuevoEstado && { estado: nuevoEstado }) },
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
      mesero: { select: { nombre: true } },
      items: { include: { producto: true } },
    },
  });
  if (!pedido || (req.user!.rol === 'REPARTIDOR' && pedido.tipo !== 'PARA_LLEVAR')) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
  res.json(pedido);
}

export async function createPedido(req: Request, res: Response): Promise<void> {
  const { tipo, items } = req.body;
  const meseroId = req.user!.userId;
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

  const total = itemsData.reduce((s: number, i: any) => s + i.subtotal, 0);

  // Заказ без блюд для кухни (только напитки/соусы) на кухню не идёт: сразу «Готов к подаче»,
  // иначе он навсегда застрял бы в «На кухне» — кухня его не видит, выдать и оплатить нельзя.
  const sinCocina = !items.some((it: any) => productos.find((p) => p.id === it.productoId)?.requiereCocina);

  const pedido = await prisma.$transaction(async (tx) => {
    const p = await tx.pedido.create({
      data: {
        tipo,
        mesaId: mesaId || null,
        meseroId,
        restauranteId: req.restauranteId!,
        total,
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

    if (mesaId) {
      // Атомарно занимаем стол: два официанта не могут одновременно открыть заказ на один стол
      const m = await tx.mesa.updateMany({ where: { id: mesaId, restauranteId: req.restauranteId!, estado: 'LIBRE' }, data: { estado: 'OCUPADA' } });
      if (m.count === 0) throw new HttpError(409, 'Mesa ocupada');
    }

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

  // Повар двигает заказ только по кухонным статусам: не отменяет и не закрывает заказ
  if (req.user!.rol === 'COCINERO' && !['EN_PREPARACION', 'LISTO'].includes(estado)) throw new HttpError(403, 'Sin permisos para esta acción');

  const pedido = await prisma.pedido.findFirst({
    where: { id, restauranteId: req.restauranteId! },
  });
  if (!pedido) { res.status(404).json({ error: 'Pedido no encontrado' }); return; }
  // Доставщик только отдаёт готовые заказы «с собой»; отменять и менять другие статусы не может
  if (req.user!.rol === 'REPARTIDOR' && (estado !== 'ENTREGADO' || pedido.tipo !== 'PARA_LLEVAR')) throw new HttpError(403, 'Sin permisos para esta acción');

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
    // Al marcar LISTO, todos los ítems pendientes quedan como servidos
    if (estado === 'LISTO') {
      await tx.itemPedido.updateMany({
        where: { pedidoId: id, servido: false },
        data: { servido: true },
      });
    }
    const p = await tx.pedido.update({
      where: { id },
      data: updateData,
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

  const updated = await prisma.$transaction(async (tx) => {
    // Атомарно: оплатить можно только активный заказ, и ровно один раз (даже при двойном клике / двух кассах)
    const r = await tx.pedido.updateMany({
      where: { id, restauranteId: req.restauranteId!, estado: { notIn: ['PAGADO', 'CANCELADO'] } },
      data: { estado: 'PAGADO', pagado: true, metodoPago },
    });
    if (r.count === 0) {
      const existe = await tx.pedido.findFirst({ where: { id, restauranteId: req.restauranteId! }, select: { id: true } });
      throw existe ? new HttpError(409, 'El pedido ya está pagado o cancelado') : new HttpError(404, 'Pedido no encontrado');
    }
    const p = await tx.pedido.findUniqueOrThrow({ where: { id } });
    if (p.mesaId) await liberarMesa(tx, p.mesaId, id);
    return p;
  });

  // Чек сразу после оплаты: ждём автопечать (не дольше 3 с), чтобы сказать кассе, напечатан ли чек.
  // impreso=false → клиент сам откроет печать (окно Innova365 / браузер), чек не теряется.
  const imp = await Promise.race([
    imprimir({ restauranteId: req.restauranteId!, tipo: 'recibo', pedidoId: id, soloAuto: true, usuarioId: req.user!.userId }).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 3000)),
  ]);
  const ok = imp?.resultados.find((r) => r.ok);
  res.json({ ...updated, impresion: { impreso: !!ok, impresora: ok?.impresora ?? null, intentos: imp?.resultados.length ?? 0 } });
}
