import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { cached } from '../cache';
import { loadCashReport, type CashReportPeriod } from '../print/cash-report';
import { HttpError } from '../idem';
import { fillDailySales } from '../reports/daily-sales';

const TZ = process.env.TZ || 'UTC';

export async function getCashReport(req: Request, res: Response): Promise<void> {
  const raw = String(req.query.periodo ?? 'hoy');
  if (!['hoy', 'semana', 'mes'].includes(raw)) throw new HttpError(400, 'Datos inválidos');
  const period = raw as CashReportPeriod;
  res.json(await loadCashReport(req.restauranteId!, period));
}

function getPeriodRange(periodo: string): { gte: Date; lte: Date } {
  const now = new Date();
  const lte = new Date(now);
  let gte: Date;

  if (periodo === 'hoy') {
    gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (periodo === 'semana') {
    gte = new Date(now);
    gte.setHours(0, 0, 0, 0);
    gte.setDate(gte.getDate() - ((gte.getDay() + 6) % 7));
  } else {
    gte = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { gte, lte };
}

// Los reportes se agregan en PostgreSQL (GROUP BY) en lugar de traer todas las filas a Node.

export async function getVentas(req: Request, res: Response): Promise<void> {
  const periodo = String(req.query.periodo ?? 'semana');
  if (!['hoy', 'semana', 'mes'].includes(periodo)) throw new HttpError(400, 'Datos inválidos');
  const { gte, lte } = getPeriodRange(periodo);

  const rows = await cached(`${req.restauranteId}:rep:ventas:${periodo}`, 30_000, () => prisma.$queryRaw<{ fecha: string; ventas: number; pedidos: number }[]>(Prisma.sql`
    SELECT to_char(("actualizadoEn" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS fecha,
           COALESCE(SUM(total), 0)::float8 AS ventas,
           COUNT(*)::int AS pedidos
    FROM "Pedido"
    WHERE "restauranteId" = ${req.restauranteId!}
      AND estado = 'PAGADO'
      AND "actualizadoEn" >= ${gte} AND "actualizadoEn" <= ${lte}
    GROUP BY 1
    ORDER BY 1
  `));

  const totalVentas = rows.reduce((s, r) => s + r.ventas, 0);
  const totalPedidos = rows.reduce((s, r) => s + r.pedidos, 0);
  const chartData = fillDailySales(rows, gte, lte, TZ);

  res.json({ totalVentas, totalPedidos, chartData, periodo });
}

export async function getTopProductos(req: Request, res: Response): Promise<void> {
  const periodo = String(req.query.periodo ?? 'semana');
  if (!['hoy', 'semana', 'mes'].includes(periodo)) throw new HttpError(400, 'Datos inválidos');
  const { gte, lte } = getPeriodRange(periodo);

  const rows = await cached(`${req.restauranteId}:rep:productos:${periodo}`, 30_000, () => prisma.$queryRaw<{ nombre: string; cantidad: number; ingresos: number }[]>(Prisma.sql`
    SELECT p.nombre,
           SUM(i.cantidad)::int AS cantidad,
           SUM(i.subtotal)::float8 AS ingresos
    FROM "ItemPedido" i
    JOIN "Pedido" o ON o.id = i."pedidoId"
    JOIN "Producto" p ON p.id = i."productoId"
    WHERE o."restauranteId" = ${req.restauranteId!}
      AND o.estado = 'PAGADO'
      AND o."actualizadoEn" >= ${gte} AND o."actualizadoEn" <= ${lte}
    GROUP BY i."productoId", p.nombre
  `));

  const totalIngresos = rows.reduce((s, p) => s + p.ingresos, 0);
  const result = rows
    .map((p) => ({ ...p, porcentaje: totalIngresos ? Math.round((p.ingresos / totalIngresos) * 100) : 0 }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));

  res.json(result);
}

export async function getProductividad(req: Request, res: Response): Promise<void> {
  // Считаем по тому, кто отметил готовность, а время — от создания заказа до готовности.
  const periodo = String(req.query?.periodo ?? 'semana');
  if (!['hoy', 'semana', 'mes'].includes(periodo)) throw new HttpError(400, 'Datos inválidos');
  const { gte, lte } = getPeriodRange(periodo);

  const rows = await cached(`${req.restauranteId}:rep:cocineros:${periodo}`, 30_000, () => prisma.$queryRaw<{ nombre: string; pedidos: number; promedio: number }[]>(Prisma.sql`
    SELECT MAX(p."cocineroNombre") AS nombre,
           COUNT(*)::int AS pedidos,
           COALESCE(AVG(EXTRACT(EPOCH FROM (p."tiempoListo" - p."creadoEn")) / 60), 0)::float8 AS promedio
    FROM "Pedido" p
    WHERE p."restauranteId" = ${req.restauranteId!}
      AND p.estado IN ('LISTO', 'ENTREGADO', 'PAGADO')
      AND p."cocineroId" IS NOT NULL AND p."tiempoListo" IS NOT NULL
      AND p."creadoEn" >= ${gte} AND p."creadoEn" <= ${lte}
    GROUP BY p."cocineroId"
  `));

  res.json(rows.map((r) => ({ nombre: r.nombre, pedidos: r.pedidos, tiempoPromedio: Math.round(r.promedio) })));
}

/** Начисления официантам: только оплаченные заказы, ставка зафиксирована в заказе. */
export async function getWaiterEarnings(req: Request, res: Response): Promise<void> {
  const periodo = String(req.query.periodo ?? 'mes');
  if (!['hoy', 'semana', 'mes'].includes(periodo)) throw new HttpError(400, 'Datos inválidos');
  const { gte, lte } = getPeriodRange(periodo);
  const rows = await prisma.$queryRaw<{ id: string; nombre: string; pedidos: number; ventas: number; accrued: number }[]>(Prisma.sql`
    SELECT u.id, u.nombre,
           COUNT(p.id)::int AS pedidos,
           COALESCE(SUM(p.total), 0)::float8 AS ventas,
           COALESCE(SUM(p."serviceAmount"), 0)::float8 AS accrued
    FROM "Usuario" u
    LEFT JOIN "Pedido" p ON p."meseroId" = u.id
      AND p."restauranteId" = ${req.restauranteId!}
      AND p.estado = 'PAGADO'
      AND p."servicePercent" > 0
      AND p."pagadoEn" >= ${gte} AND p."pagadoEn" <= ${lte}
    WHERE u."restauranteId" = ${req.restauranteId!} AND (u.rol = 'MESERO' OR p.id IS NOT NULL)
    GROUP BY u.id, u.nombre
    ORDER BY accrued DESC, u.nombre
  `);
  res.json(rows);
}
