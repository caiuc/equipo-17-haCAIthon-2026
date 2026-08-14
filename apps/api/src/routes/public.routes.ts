import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  idParamSchema,
  liveBusesQuerySchema,
  liveQuerySchema,
  searchRoutesQuerySchema,
} from '@equipo17/shared';
import { validateParams, validateQuery } from '../middlewares/validate.js';
import { getRoute, listCompanies, searchRoutes } from '../controllers/public.controller.js';
import { getLiveBuses, getRouteLive } from '../controllers/live.controller.js';

/**
 * Todo esto va sin token: el caso de uso real es alguien parado en un paradero
 * que necesita saber si viene la micro, no alguien creandose una cuenta.
 */
export const publicRouter = Router();

/**
 * El mapa se consulta cada LIVE_POLL_INTERVAL_MS, o sea 12 veces por minuto por
 * persona. El cupo es deliberadamente holgado: en zona rural media localidad
 * sale por la misma IP del carrier, y un limite estrecho dejaria a un pueblo
 * entero sin mapa al mismo tiempo. Frena el scraping, no al usuario.
 */
const mapaLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas consultas, espera un momento' } },
});

publicRouter.get('/companies', listCompanies);

publicRouter.get('/live/buses', mapaLimiter, validateQuery(liveBusesQuerySchema), getLiveBuses);

publicRouter.get('/routes', validateQuery(searchRoutesQuerySchema), searchRoutes);
publicRouter.get('/routes/:id', validateParams(idParamSchema), getRoute);
publicRouter.get(
  '/routes/:id/live',
  validateParams(idParamSchema),
  validateQuery(liveQuerySchema),
  getRouteLive,
);
