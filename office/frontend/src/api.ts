export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) { super(message); }
}

let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'office' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try { res = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' }); }
  catch { throw new ApiError(0, 'Нет связи с сервером'); }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* не JSON */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, data?.error || `Ошибка ${res.status}`, data);
  }
  return data as T;
}
export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T = any>(p: string, b?: unknown) => api<T>('PUT', p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) => api<T>('PATCH', p, b ?? {});
export const del = <T = any>(p: string) => api<T>('DELETE', p);
export const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
};

/** Загрузка файла-вложения: тело запроса — сам файл, имя и объект — в адресе. */
export async function upload(entity: string, entityId: string, file: File): Promise<void> {
  if (file.size > 10 * 1024 * 1024) throw new ApiError(413, `«${file.name}» больше 10 МБ`);
  let res: Response;
  try {
    res = await fetch(`/api/files?entity=${encodeURIComponent(entity)}&entityId=${encodeURIComponent(entityId)}&name=${encodeURIComponent(file.name)}`, {
      method: 'POST', headers: { 'X-Requested-With': 'office', 'Content-Type': file.type || 'application/octet-stream' }, body: file, credentials: 'same-origin',
    });
  } catch { throw new ApiError(0, 'Нет связи с сервером'); }
  if (!res.ok) { let msg = `Ошибка ${res.status}`; try { msg = (await res.json()).error || msg; } catch { /* не JSON */ } throw new ApiError(res.status, msg); }
}
