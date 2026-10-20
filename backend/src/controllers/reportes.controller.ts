import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { cached } from '../cache';

const TZ = process.env.TZ || 'UTC';

function getPeriodRange(periodo: string): { gte: Date; lte: Date } {
  const now = new Date();
  const lte = new Date(now);
  let gte: Date;

  if (periodo === 'hoy') {
    gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (periodo === 'semana') {
    gte = new Date(now);
    gte.setDate(gte.getDate() - 6);
    gte.setHours(0, 0, 0, 0);
  } else {
    gte = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { gte, lte };
}

// Los reportes se agregan en PostgreSQL (GROUP BY) en lugar de traer todas las filas a Node.

export async function getVentas(req: Request, res: Response): Promise<void> {
  const periodo = (req.query.periodo as string) || 'semana';
  const { gte, lte } = getPeriodRange(periodo);

  const rows = await cached(`${req.restauranteId}:rep:ventas:${periodo}`, 30_000, () => prisma.$queryRaw<{ fecha: string; ventas: number; pedidos: number }[]>(Prisma.sql`
    SELECT to_char(("creadoEn" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS fecha,
           COALESCE(SUM(total), 0)::float8 AS ventas,
           COUNT(*)::int AS pedidos
    FROM "Pedido"
    WHERE "restauranteId" = ${req.restauranteId!}
      AND estado = 'PAGADO'
      AND "creadoEn" >= ${gte} AND "creadoEn" <= ${lte}
    GROUP BY 1
    ORDER BY 1
  `));

  const totalVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const chartData = rows.map((r) => ({ fecha: r.fecha, ventas: r.ventas, pedidos: r.pedidos }));

  res.json({ totalVentas, totalPedidos, chartData, periodo });
}

export async function getTopProductos(req: Request, res: Response): Promise<void> {
  const { gte, lte } = getPeriodRange('mes');

  const rows = await cached(`${req.restauranteId}:rep:productos`, 30_000, () => prisma.$queryRaw<{ nombre: string; cantidad: number; ingresos: number }[]>(Prisma.sql`
    SELECT p.nombre,
           SUM(i.cantidad)::int AS cantidad,
           SUM(i.subtotal)::float8 AS ingresos
    FROM "ItemPedido" i
    JOIN "Pedido" o ON o.id = i."pedidoId"
    JOIN "Producto" p ON p.id = i."productoId"
    WHERE o."restauranteId" = ${req.restauranteId!}
      AND o.estado = 'PAGADO'
      AND o."creadoEn" >= ${gte} AND o."creadoEn" <= ${lte}
    GROUP BY i."productoId", p.nombre
  `));

  const totalIngresos = rows.reduce((s, p) => s + p.ingresos, 0);
  const result = rows
    .map((p) => ({ ...p, porcentaje: totalIngresos ? Math.round((p.ingresos / totalIngresos) * 100) : 0 }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre))
    .slice(0, 10);

  res.json(result);
}

export async function getProductividad(req: Request, res: Response): Promise<void> {
  const { gte, lte } = getPeriodRange('semana');

  const rows = await cached(`${req.restauranteId}:rep:cocineros`, 30_000, () => prisma.$queryRaw<{ nombre: string; pedidos: number; promedio: number }[]>(Prisma.sql`
    SELECT u.nombre,
           COUNT(*)::int AS pedidos,
           COALESCE(AVG(EXTRACT(EPOCH FROM (p."tiempoListo" - p."tiempoInicio")) / 60), 0)::float8 AS promedio
    FROM "Pedido" p
    JOIN "Usuario" u ON u.id = p."meseroId"
    WHERE p."restauranteId" = ${req.restauranteId!}
      AND p.estado IN ('LISTO', 'ENTREGADO', 'PAGADO')
      AND p."tiempoInicio" IS NOT NULL AND p."tiempoListo" IS NOT NULL
      AND p."creadoEn" >= ${gte} AND p."creadoEn" <= ${lte}
    GROUP BY p."meseroId", u.nombre
  `));

  res.json(rows.map((r) => ({ nombre: r.nombre, pedidos: r.pedidos, tiempoPromedio: Math.round(r.promedio) })));
}
