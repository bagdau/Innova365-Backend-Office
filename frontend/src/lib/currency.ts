import { locale } from '../i18n';

/** Поддерживаемые валюты (список совпадает с backend/src/currency.ts). before — символ перед суммой. */
export const CURRENCIES = [
  { code: 'KZT', symbol: '₸', decimals: 0 },
  { code: 'RUB', symbol: '₽', decimals: 2 },
  { code: 'KGS', symbol: 'сом', decimals: 2 },
  { code: 'UZS', symbol: 'сум', decimals: 0 },
  { code: 'BYN', symbol: 'Br', decimals: 2 },
  { code: 'UAH', symbol: '₴', decimals: 2 },
  { code: 'TJS', symbol: 'SM', decimals: 2 },
  { code: 'AMD', symbol: '֏', decimals: 0 },
  { code: 'AZN', symbol: '₼', decimals: 2 },
  { code: 'GEL', symbol: '₾', decimals: 2 },
  { code: 'MDL', symbol: 'L', decimals: 2 },
  { code: 'TRY', symbol: '₺', decimals: 2 },
  { code: 'USD', symbol: '$', decimals: 2, before: true },
  { code: 'EUR', symbol: '€', decimals: 2, before: true },
  { code: 'PEN', symbol: 'S/', decimals: 2, before: true },
] as const;

export type CurrencyInfo = { code: string; symbol: string; decimals: number; before?: boolean };

const KEY = 'innova365-currency';
const DEFAULT = 'KZT';

function load(): string {
  try { return localStorage.getItem(KEY) || DEFAULT; } catch { return DEFAULT; }
}

let current: CurrencyInfo = (CURRENCIES.find((c) => c.code === load()) ?? CURRENCIES[0]) as CurrencyInfo;

export const getCurrency = (): CurrencyInfo => current;
export const currencySymbol = (): string => current.symbol;
export const currencyCode = (): string => current.code;

/** Вызывается при загрузке настроек ресторана. Возвращает true, если валюта изменилась. */
export function setCurrencyCode(code?: string | null): boolean {
  const next = (CURRENCIES.find((c) => c.code === code) ?? null) as CurrencyInfo | null;
  if (!next || next.code === current.code) return false;
  current = next;
  try { localStorage.setItem(KEY, next.code); } catch { /* ignore */ }
  return true;
}

/** Сумма с символом валюты: «1 500 ₸», «12,50 ₽», «$12.50». */
export function fmtMoney(n: number): string {
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: current.decimals, maximumFractionDigits: current.decimals }).format(n);
  return current.before ? `${current.symbol}${num}` : `${num} ${current.symbol}`;
}

/** Локализованное название валюты («тенге», «Russian ruble»). */
export function currencyName(code: string): string {
  try { return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code; } catch { return code; }
}
