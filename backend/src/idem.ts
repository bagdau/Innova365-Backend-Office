import { Prisma } from '@prisma/client';

/**
 * Идемпотентность операций склада.
 *
 * Клиент создаёт случайный ключ один раз на операцию и повторяет его при любом ретрае
 * (плохая сеть, двойной тап). Первый запрос выполняет работу и сохраняет результат;
 * повтор с тем же ключом возвращает сохранённый результат и ничего не меняет повторно —
 * закупка не создастся дважды, остатки не прибавятся дважды.
 */
export async function idempotent<T>(
  tx: Prisma.TransactionClient,
  clave: string | undefined,
  restauranteId: string,
  tipo: string,
  work: () => Promise<T>,
): Promise<{ value: T; replay: boolean }> {
  if (!clave) return { value: await work(), replay: false };

  const inserted = await tx.$executeRaw`
    INSERT INTO "OperacionIdem" (clave, "restauranteId", tipo)
    VALUES (${clave}, ${restauranteId}, ${tipo})
    ON CONFLICT (clave) DO NOTHING`;

  if (inserted === 0) {
    const row = await tx.operacionIdem.findUnique({ where: { clave } });
    if (row && row.restauranteId === restauranteId && row.tipo === tipo && row.resultado !== null) {
      return { value: row.resultado as unknown as T, replay: true };
    }
    throw new HttpError(409, 'La operación ya está en curso');
  }

  const value = await work();
  await tx.operacionIdem.update({ where: { clave }, data: { resultado: JSON.parse(JSON.stringify(value)) } });
  return { value, replay: false };
}

/** Ошибка с HTTP-статусом (её понимает error middleware). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
