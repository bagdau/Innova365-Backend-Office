import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { desktopRestaurant } from '../controllers/desktop.controller';

export interface JwtPayload {
  userId: string;
  restauranteId: string;
  rol: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      restauranteId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const desktopId = await desktopRestaurant(req);
    if (desktopId === false || (desktopId && desktopId !== payload.restauranteId)) {
      res.status(401).json({ error: 'Активация приложения недействительна' });
      return;
    }
    req.user = payload;
    req.restauranteId = payload.restauranteId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
