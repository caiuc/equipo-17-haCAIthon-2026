import { Router } from 'express';
import { idParamSchema, liveQuerySchema, searchRoutesQuerySchema } from '@equipo17/shared';
import { validateParams, validateQuery } from '../middlewares/validate.js';
import { getRoute, searchRoutes } from '../controllers/public.controller.js';
import { getRouteLive } from '../controllers/live.controller.js';

/**
 * Todo esto va sin token: el caso de uso real es alguien parado en un paradero
 * que necesita saber si viene la micro, no alguien creandose una cuenta.
 */
export const publicRouter = Router();

publicRouter.get('/routes', validateQuery(searchRoutesQuerySchema), searchRoutes);
publicRouter.get('/routes/:id', validateParams(idParamSchema), getRoute);
publicRouter.get(
  '/routes/:id/live',
  validateParams(idParamSchema),
  validateQuery(liveQuerySchema),
  getRouteLive,
);
