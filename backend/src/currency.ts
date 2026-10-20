/** Поддерживаемые валюты: код → знаков после запятой. Список общий с фронтендом (frontend/src/lib/currency.ts). */
export const CURRENCIES: Record<string, number> = {
  KZT: 0, RUB: 2, KGS: 2, UZS: 0, BYN: 2, UAH: 2, TJS: 2, AMD: 0, AZN: 2, GEL: 2, MDL: 2, TRY: 2, USD: 2, EUR: 2, PEN: 2,
};

export const DEFAULT_CURRENCY = 'KZT';
export const isCurrency = (c: unknown): c is string => typeof c === 'string' && c in CURRENCIES;

/** Сумма для термопринтера. В кодировках cp866/cp1251 нет ₸ ₽ ⃀, поэтому печатаем ISO-код: «1500 KZT». */
export function moneyCode(n: number, code?: string | null): string {
  const c = code && isCurrency(code) ? code : DEFAULT_CURRENCY;
  return `${n.toFixed(CURRENCIES[c])} ${c}`;
}
