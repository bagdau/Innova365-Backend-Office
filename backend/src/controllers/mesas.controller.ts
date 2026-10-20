import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { EstadoMesa } from '@prisma/client';
import { HttpError } from '../idem';


export async function getMesas(req: Request, res: Response): Promise<void> {
  const mesas = await prisma.mesa.findMany({
    where: { restauranteId: req.restauranteId! },
    orderBy: { numero: 'asc' },
    include: {
      pedidos: {
        where: { estado: { notIn: ['PAGADO', 'CANCELADO'] } },
        orderBy: { creadoEn: 'desc' },
        take: 1,
        include: {
          mesero: { select: { nombre: true } },
          items: {
            include: { producto: { select: { nombre: true } } },
          },
        },
      },
    },
  });

  const result = mesas.map((m) => {
    const pedidoActivo = m.pedidos[0] ?? null;
    let timerRestante: number | null = null;

    if (pedidoActivo?.estado === 'ENTREGADO' && pedidoActivo.tiempoListo) {
      const restaurante_timer = 45;
      const minutos = Math.floor(
        (Date.now() - new Date(pedidoActivo.tiempoListo).getTime()) / 60000
      );
      timerRestante = restaurante_timer - minutos;
    }

    return {
      id: m.id,
      numero: m.numero,
      capacidad: m.capacidad,
      estado: m.estado,
      pedidoActivo,
      timerRestante,
      mesero: pedidoActivo?.mesero?.nombre ?? null,
    };
  });

  res.json(result);
}

export async function createMesa(req: Request, res: Response): Promise<void> {
  const { numero, capacidad } = req.body;
  if (await prisma.mesa.findFirst({ where: { restauranteId: req.restauranteId!, numero }, select: { id: true } })) throw new HttpError(409, 'Стол с таким номером уже существует');
  const mesa = await prisma.mesa.create({
    data: { numero, capacidad: capacidad ?? 4, restauranteId: req.restauranteId! },
  });
  res.status(201).json(mesa);
}

export async function updateEstadoMesa(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { estado } = req.body;

  if (!Object.values(EstadoMesa).includes(estado)) {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }

  const mesa = await prisma.mesa.update({
    where: { id, restauranteId: req.restauranteId! },
    data: { estado },
  });
  res.json(mesa);
}

export async function updateMesa(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { numero, capacidad } = req.body;
  if (numero !== undefined && await prisma.mesa.findFirst({ where: { restauranteId: req.restauranteId!, numero, NOT: { id } }, select: { id: true } })) throw new HttpError(409, 'Стол с таким номером уже существует');
  const mesa = await prisma.mesa.update({
    where: { id, restauranteId: req.restauranteId! },
    data: { numero, capacidad },
  });
  res.json(mesa);
}

export async function deleteMesa(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const activo = await prisma.pedido.count({ where: { mesaId: id, estado: { notIn: ['PAGADO', 'CANCELADO'] } } });
  if (activo > 0) throw new HttpError(409, 'За столом есть незавершённый заказ — сначала закройте или отмените его');
  const hist = await prisma.pedido.count({ where: { mesaId: id } });
  if (hist > 0) throw new HttpError(409, 'У стола есть история заказов — удалить нельзя');
  await prisma.mesa.delete({ where: { id, restauranteId: req.restauranteId! } });
  res.status(204).send();
}
