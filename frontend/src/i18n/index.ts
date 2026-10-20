import { dict } from './dict';
import { dictKk } from './dict.kk';

export type Lang = 'ru' | 'en' | 'kk';

const STORAGE_KEY = 'innova365-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en' || saved === 'kk') return saved;
  } catch { /* storage no disponible */ }
  return 'ru';
}

export const lang: Lang = detect();

/** BCP-47 locale para Intl / toLocale*String */
export const locale = lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-US';

/** Язык документов для печати: кириллица ESC/POS (cp866/cp1251) не содержит казахских букв, поэтому для kk печатаем по-русски. */
export const printLang: 'ru' | 'en' = lang === 'en' ? 'en' : 'ru';

document.documentElement.lang = lang;

/** Cambia el idioma y recarga la página (los textos se resuelven al cargar). */
export function setLang(next: Lang) {
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  window.location.reload();
}

/**
 * Traduce un texto fuente (español). Si no hay traducción, devuelve el original.
 * Admite variables: t('Mesa {n}', { n: 3 }).
 */
export function t(es: string, vars?: Record<string, string | number>): string {
  const entry = dict[es];
  const out0 = lang === 'kk' ? (dictKk[es] ?? entry?.[0]) : entry?.[lang === 'ru' ? 0 : 1];
  let out = out0 ?? es;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  return out;
}

/** Mensaje de error de la API traducido (o el texto por defecto si no hay respuesta). */
export function apiError(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof msg === 'string' ? t(msg) : t(fallback);
}
