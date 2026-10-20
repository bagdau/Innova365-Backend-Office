import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../idem';

/**
 * Catch-all para errores que escapen de los controladores.
 * Convierte errores de Prisma en respuestas HTTP útiles.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // body-parser: невалидный JSON / слишком большое тело
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Некорректный JSON в запросе' }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ error: 'Запрос слишком большой' }); return; }

  // multer: файл слишком большой и т.п.
  if (err?.name === 'MulterError' || /^Multipart/.test(err?.message ?? '')) {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой (максимум 8 МБ)' : 'Ошибка загрузки файла' });
    return;
  }

  // Errores conocidos de Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un registro con esos datos únicos' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'No se puede eliminar: hay registros relacionados' });
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'Datos inválidos para la operación' });
    return;
  }

  // Logging para debug en dev
  console.error('[Error no manejado]', err);

  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? undefined : err?.message,
  });
}
