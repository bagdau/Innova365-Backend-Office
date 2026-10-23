/**
 * Кэш тяжёлых отчётов. Любое изменение в БД (уведомление PostgreSQL, см. events.ts) или запись через сам Office
 * сбрасывает его целиком, поэтому отчёт всегда отражает последние данные, а повторные открытия и одновременные
 * запросы нескольких пользователей считаются один раз. TTL 10 с — страховка на случай потери уведомления.
 */
const TTL_MS = 10_000;
const store = new Map<string, { at: number; value: Promise<unknown> }>();

export const bumpData = (): void => { store.clear(); };

export function memo<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = compute();
  const entry = { at: Date.now(), value };
  store.set(key, entry);
  value.catch(() => { if (store.get(key) === entry) store.delete(key); });   // ошибки не кэшируем
  return value;
}
