import { NextFunction, Request, Response } from 'express';
import { getSession, HttpError, Session } from './sessions';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { session?: Session; db?: string } }
}

export const ah = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

/** Требует вход в систему; база берётся из заголовка X-Db. */
export function auth(req: Request, _res: Response, next: NextFunction): void {
  const s = getSession(req.cookies?.dbs_sid);
  if (!s) { next(new HttpError(401, 'Требуется вход')); return; }
  req.session = s;
  const db = req.header('x-db') || (typeof req.query.db === 'string' ? req.query.db : undefined);
  req.db = db && /^[\w$.\- ]{1,63}$/.test(db) ? db : undefined;
  next();
}

/** Операции изменения данных/структуры доступны только в режиме записи. */
export function requireWrite(req: Request): void {
  if (req.session!.readOnly) throw new HttpError(403, 'Включён режим «Только чтение». Включите режим записи в шапке.');
}

export const str = (v: unknown, name: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `Поле «${name}» обязательно`);
  if (v.length > max) throw new HttpError(400, `Поле «${name}» слишком длинное`);
  return v;
};

/** Идентификатор (имя таблицы/колонки/роли): любые символы кроме NUL, но ограниченной длины. */
export const ident = (v: unknown, name: string): string => {
  const s = str(v, name, 63);
  if (s.includes('\0')) throw new HttpError(400, `Некорректное имя «${name}»`);
  return s;
};

/** Преобразует ошибку PostgreSQL в ответ API. */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message, ...err.extra }); return; }
  if (err?.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code)) {
    const auth = err.code === '28P01' || err.code === '28000';
    res.status(auth ? 401 : 400).json({
      error: auth ? 'Неверное имя пользователя или пароль' : err.message,
      pg: { code: err.code, detail: err.detail, hint: err.hint, position: err.position ? Number(err.position) : undefined, where: err.where },
    });
    return;
  }
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
    res.status(503).json({ error: 'Сервер базы данных недоступен' }); return;
  }
  if (err?.name === 'MulterError') { res.status(413).json({ error: 'Файл слишком большой' }); return; }
  console.error('[error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервиса' });
}
