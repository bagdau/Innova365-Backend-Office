import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Envuelve un controller async para que cualquier excepción no capturada
 * se pase a next(err) → errorHandler, en vez de crashear el proceso.
 * Compatible con Express 4.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
