import type { RequestHandler } from 'express';
import type { Role } from '@equipo17/shared';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { HttpError } from './error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

const readBearer = (header: string | undefined): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

/** Adjunta req.auth si hay token valido. No falla si no lo hay. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readBearer(req.headers.authorization);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.auth = payload;
  }
  next();
};

/** Exige token valido. 401 si falta o no sirve. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readBearer(req.headers.authorization);
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new HttpError(401, 'No autenticado');
  req.auth = payload;
  next();
};

/** Exige uno de los roles dados. Usar siempre despues de requireAuth. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw new HttpError(401, 'No autenticado');
    if (!roles.includes(req.auth.role)) throw new HttpError(403, 'Sin permisos para esta accion');
    next();
  };

/**
 * Aislamiento multitenant: devuelve el companyId del token o corta.
 * Todo query de empresa debe filtrar por este valor, nunca por uno del body.
 */
export const companyIdOf = (req: { auth?: TokenPayload }): string => {
  const companyId = req.auth?.companyId;
  if (!companyId) throw new HttpError(403, 'La cuenta no pertenece a ninguna empresa');
  return companyId;
};
