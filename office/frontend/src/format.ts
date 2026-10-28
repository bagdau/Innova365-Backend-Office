import { locale } from './i18n';

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SYMBOLS: Record<string, string> = { KZT: '₸', RUB: '₽', KGS: 'сом', UZS: 'сум', BYN: 'Br', UAH: '₴', USD: '$', EUR: '€', TRY: '₺', GEL: '₾', AMD: '֏', AZN: '₼' };
let currency = 'KZT';
export const setCurrency = (c: string) => { currency = c || 'KZT'; };
export const currencySymbol = () => SYMBOLS[currency] ?? currency;
let timezone = 'Asia/Almaty';
export const setTimezone = (tz: string) => { timezone = tz || 'Asia/Almaty'; };

/** Сумма: целые для тенге/сума, копейки для остальных. */
export function money(v: number | null | undefined, opts: { sign?: boolean; plain?: boolean } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const zero = currency === 'KZT' || currency === 'UZS' || currency === 'AMD';
  const s = (zero ? nf0 : nf2).format(Math.abs(v));
  const sign = v < 0 ? '−' : opts.sign && v > 0 ? '+' : '';
  return `${sign}${s}${opts.plain ? '' : ' ' + currencySymbol()}`;
}
export const num = (v: number | null | undefined, digits = 0): string =>
  v === null || v === undefined ? '—' : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(v);
export const pct = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${num(v, 1)}%`);

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', ...(iso.length === 10 ? {} : { timeZone: timezone }) });
};
export const fmtDateTime = (iso: string | null | undefined): string =>
  (iso ? new Date(iso).toLocaleString(locale(), { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—');
export const fmtShort = (iso: string): string => new Date(iso + 'T00:00:00').toLocaleDateString(locale(), { day: '2-digit', month: 'short' });

/** Сегодня в часовом поясе ресторана (YYYY-MM-DD). */
export const todayIn = (tz: string): string => new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
export const addDays = (iso: string, n: number): string => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
