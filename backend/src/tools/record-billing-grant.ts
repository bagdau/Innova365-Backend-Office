import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { addBillingMonths } from '../billing';

// Operator-only command. Run after confirming payment outside the POS.
const [restauranteId, monthsText, reference] = process.argv.slice(2);
const months = Number(monthsText);
if (!restauranteId || !/^[a-zA-Z0-9_-]{4,100}$/.test(restauranteId) ||
    !Number.isInteger(months) || months < 1 || months > 24 ||
    !reference || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{5,119}$/.test(reference)) {
  process.stderr.write('Usage: npm run billing:grant -- <restaurant-id> <months:1-24> <unique-payment-reference>\n');
  process.exit(2);
}

const prisma = new PrismaClient();
async function main() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.billingGrant.findUnique({ where: { reference } });
        if (existing) {
          if (existing.restauranteId !== restauranteId || existing.months !== months) throw new Error('Номер платежа уже применён к другому продлению');
          return { alreadyApplied: true, paidUntil: existing.paidUntil.toISOString() };
        }
        const restaurant = await tx.restaurante.findUnique({ where: { id: restauranteId }, select: { id: true } });
        if (!restaurant) throw new Error('Заведение не найдено');
        const current = await tx.billingSubscription.findUnique({ where: { restauranteId } });
        const now = new Date();
        const base = current && current.paidUntil > now ? current.paidUntil : now;
        const paidUntil = addBillingMonths(base, months);
        await tx.billingGrant.create({ data: { restauranteId, months, reference, previousUntil: current?.paidUntil ?? null, paidUntil } });
        await tx.billingSubscription.upsert({ where: { restauranteId }, create: { restauranteId, paidUntil }, update: { paidUntil } });
        return { alreadyApplied: false, paidUntil: paidUntil.toISOString() };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002') && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Не удалось записать продление после повторных попыток');
}

main().then((result) => process.stdout.write(JSON.stringify(result) + '\n'))
  .catch((error) => { process.stderr.write(String(error.message || error) + '\n'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
