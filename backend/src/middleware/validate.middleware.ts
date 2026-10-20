import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Valida el body de la request contra un schema de Zod.
 * Si falla, devuelve 400 con los errores. Si pasa, reemplaza req.body
 * con la versión parseada (con coerce, defaults, etc).
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        detalles: result.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
