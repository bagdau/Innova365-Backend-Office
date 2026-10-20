import { Request, Response, NextFunction } from 'express';
import { isAdminRole, isOwner } from '../roles';

/**
 * Доступ по ролям. Владелец (SUPERADMIN) и администратор (ADMIN) проходят всегда —
 * у них права на просмотр и изменение всего, что доступно другим ролям.
 */
export function roleMiddleware(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!isAdminRole(req.user.rol) && !roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'Sin permisos para esta acción' });
      return;
    }
    next();
  };
}

/** Только владелец (SUPERADMIN). */
export function ownerOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  if (!isOwner(req.user.rol)) {
    res.status(403).json({ error: 'Solo el propietario puede hacer esto' });
    return;
  }
  next();
}
