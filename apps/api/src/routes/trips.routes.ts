import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { idParamSchema, reportOccupancySchema } from '@equipo17/shared';
import { validateBody, validateParams } from '../middlewares/validate.js';
import { optionalAuth } from '../middlewares/auth.js';
import { reportOccupancy } from '../controllers/trips.controller.js';

export const tripsRouter = Router();

// Endpoint anonimo: sin freno, una sola persona podria inflar el contador
// cambiando su deviceId. Esto acota el dano sin exigir cuenta.
const occupancyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Demasiados reportes, espera un momento' } },
});

tripsRouter.post(
  '/trips/:id/occupancy',
  occupancyLimiter,
  optionalAuth,
  validateParams(idParamSchema),
  validateBody(reportOccupancySchema),
  reportOccupancy,
);
