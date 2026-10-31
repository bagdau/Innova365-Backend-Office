import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { billingStatus } from '../billing';

export async function getBillingStatus(req: Request, res: Response): Promise<void> {
  const subscription = await prisma.billingSubscription.findUnique({ where: { restauranteId: req.restauranteId! } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ...billingStatus(subscription?.paidUntil ?? null), serverTime: new Date().toISOString() });
}
