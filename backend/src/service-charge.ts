import { Prisma } from '@prisma/client';

/** Денежный расчёт в десятичных числах, округление до тиына только один раз. */
export function serviceCharge(subtotal: Prisma.Decimal, percent: Prisma.Decimal, decimals = 2): Prisma.Decimal {
  return subtotal.mul(percent).div(100).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
}
