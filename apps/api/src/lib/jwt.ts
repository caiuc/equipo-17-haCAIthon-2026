import jwt from 'jsonwebtoken';
import type { Role } from '@equipo17/shared';
import { env } from '../config/env.js';

export type TokenPayload = {
  sub: string;
  role: Role;
  companyId: string | null;
};

export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  } as jwt.SignOptions);

/** Devuelve null si el token es invalido o expiro: el llamador responde 401. */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string') return null;
    return decoded as TokenPayload;
  } catch {
    return null;
  }
};
