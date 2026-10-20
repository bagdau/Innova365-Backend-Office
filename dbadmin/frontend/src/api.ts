/** Клиент API сервиса DB Studio. База данных передаётся заголовком X-Db. */
let currentDb: string | undefined;
let onUnauthorized: (() => void) | undefined;

export const setCurrentDb = (db: string | undefined) => { currentDb = db; };
export const getCurrentDb = () => currentDb;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export interface PgInfo { code?: string; detail?: string; hint?: string; position?: number; where?: string }

export class ApiError extends Error {
  constructor(public status: number, message: string, public pg?: PgInfo, public data?: any) { super(message); }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'dbstudio' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (currentDb) headers['X-Db'] = currentDb;
  let res: Response;
  try {
    res = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* не JSON */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, data?.error || `Ошибка ${res.status}`, data?.pg, data);
  }
  return data as T;
}

export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) => api<T>('PATCH', p, b ?? {});
export const del = <T = any>(p: string, b?: unknown) => api<T>('DELETE', p, b);

export const enc = encodeURIComponent;
export const tpath = (schema: string, name: string) => `/tables/${enc(schema)}/${enc(name)}`;

/** Ссылка для скачивания (GET) с указанием базы в query. */
export function downloadUrl(path: string, params: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  if (currentDb) q.set('db', currentDb);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, v);
  return `/api${path}?${q.toString()}`;
}

export async function upload<T = any>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'dbstudio' };
  if (currentDb) headers['X-Db'] = currentDb;
  const res = await fetch('/api' + path, { method: 'POST', headers, body: form, credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Ошибка ${res.status}`, data?.pg, data);
  return data as T;
}
