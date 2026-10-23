import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, ZodTypeAny, z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export const ah = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

/** Разбор и проверка данных запроса; ошибки превращаются в понятный ответ 400. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const where = first.path.length ? ` (${first.path.join('.')})` : '';
    throw new HttpError(400, `${first.message}${where}`, { issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  }
  return r.data;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message, ...err.extra }); return; }
  if (err instanceof ZodError) { res.status(400).json({ error: err.issues[0]?.message || 'Некорректные данные' }); return; }
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Некорректный JSON' }); return; }
  // ошибки PostgreSQL
  if (err?.code === '23505') { res.status(409).json({ error: 'Такая запись уже существует' }); return; }
  if (err?.code === '23503') { res.status(409).json({ error: 'Запись связана с другими данными — удалить нельзя' }); return; }
  if (err?.code === '23514' || err?.code === '22P02' || err?.code === '22007' || err?.code === '22003') { res.status(400).json({ error: 'Некорректное значение' }); return; }
  console.error('[error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервиса' });
}

/* ───────── даты и числа ───────── */
export const todayIso = (tz: string): string => new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД').refine((s) => { const d = new Date(s + 'T00:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, 'Некорректная дата');

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** Период из query: from/to; по умолчанию — текущий месяц до сегодняшнего дня. */
export function periodOf(req: Request, tz: string): { from: string; to: string } {
  const today = todayIso(tz);
  let from = typeof req.query.from === 'string' ? req.query.from : today.slice(0, 8) + '01';
  let to = typeof req.query.to === 'string' ? req.query.to : today;
  parse(isoDate, from); parse(isoDate, to);
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) > 3700) throw new HttpError(400, 'Период слишком большой (максимум 10 лет)');
  return { from, to };
}

export const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

/** Месяц-интервалы внутри периода для пропорционального расчёта аренды: сумма по дням (аренда / дней в месяце). */
export function rentForPeriod(rentMonthly: number, from: string, to: string, start?: string | null, end?: string | null): number {
  let sum = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if ((start && d < start) || (end && d > end)) continue;
    const [y, m] = d.split('-').map(Number);
    sum += rentMonthly / new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  return round2(sum);
}
