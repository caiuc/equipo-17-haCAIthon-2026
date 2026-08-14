import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema } from '@equipo17/shared';
import { validateBody } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { login, me, register } from '../controllers/auth.controller.js';

export const authRouter = Router();

// Freno a la fuerza bruta contra credenciales (§5.1).
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, espera unos minutos' } },
});

authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.get('/me', requireAuth, me);
