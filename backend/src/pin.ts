import { createHmac } from 'node:crypto';

/** Индекс для поиска PIN без хранения четырёх цифр в открытом виде. */
export function pinKey(pin: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET требуется для входа по PIN');
  return createHmac('sha256', secret).update(`innova365:pin:${pin}`).digest('hex');
}
