import { Router } from 'express';
import {
  idParamSchema,
  postPositionsSchema,
  reportOccupancySchema,
  startTripSchema,
} from '@equipo17/shared';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  activeTrip,
  endTrip,
  listRoutes,
  reportOccupancy,
  startTrip,
} from '../controllers/driver.controller.js';
import { postPositions } from '../controllers/position.controller.js';

export const driverRouter = Router();

driverRouter.use(requireAuth, requireRole('DRIVER'));

driverRouter.get('/routes', listRoutes);
driverRouter.get('/trips/active', activeTrip);
driverRouter.post('/trips/start', validateBody(startTripSchema), startTrip);
driverRouter.post('/trips/:id/end', validateParams(idParamSchema), endTrip);

// El camino mas transitado del sistema: un POST cada pocos segundos por micro.
driverRouter.post(
  '/trips/:id/positions',
  validateParams(idParamSchema),
  validateBody(postPositionsSchema),
  postPositions,
);

driverRouter.post(
  '/trips/:id/occupancy',
  validateParams(idParamSchema),
  validateBody(reportOccupancySchema),
  reportOccupancy,
);
