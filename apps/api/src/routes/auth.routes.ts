import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema } from '@equipo17/shared';
import { isProduction } from '../config/env.js';
import { validateBody } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { login, me, register } from '../controllers/auth.controller.js';

export const authRouter = Router();

/**
 * Freno a la fuerza bruta contra credenciales (§5.1).
 *
 * El cupo se levanta fuera de produccion porque el simulador hace un login por
 * micro: con 18 choferes la primera corrida gasta 18 de 30 y la segunda revienta
 * a mitad de flota, justo en el ensayo o en el reintento frente al jurado.
 * Se sube el numero y NO se agrega `skip: () => !isProduction`: desactivar el
 * limitador en dev y en tests dejaria pasar una regresion hasta produccion sin
 * que nadie la note.
 */
const AUTH_RATE_LIMIT = isProduction ? 30 : 300;

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: AUTH_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, espera unos minutos' } },
});

authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.get('/me', requireAuth, me);
