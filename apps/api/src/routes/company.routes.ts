import { Router } from 'express';
import {
  createDriverSchema,
  createRouteSchema,
  createZoneSchema,
  idParamSchema,
  regionIdParamSchema,
  replaceStopsSchema,
  updateDriverSchema,
  updateRouteSchema,
  upsertScheduleSchema,
} from '@equipo17/shared';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  createDriver,
  createRoute,
  deleteRoute,
  getRoute,
  listDrivers,
  listRoutes,
  liveTrips,
  replaceStops,
  updateDriver,
  updateRoute,
  upsertSchedules,
} from '../controllers/company.controller.js';
import { createZone, listRegions } from '../controllers/region.controller.js';

/**
 * Todo lo de aqui esta limitado al companyId del token, nunca a uno que venga
 * del body o de la URL: es el aislamiento multitenant que exige §5.1.
 */
export const companyRouter = Router();

companyRouter.use(requireAuth, requireRole('COMPANY_ADMIN'));

companyRouter.get('/routes', listRoutes);
companyRouter.post('/routes', validateBody(createRouteSchema), createRoute);
companyRouter.get('/routes/:id', validateParams(idParamSchema), getRoute);
companyRouter.patch(
  '/routes/:id',
  validateParams(idParamSchema),
  validateBody(updateRouteSchema),
  updateRoute,
);
companyRouter.delete('/routes/:id', validateParams(idParamSchema), deleteRoute);
companyRouter.put(
  '/routes/:id/stops',
  validateParams(idParamSchema),
  validateBody(replaceStopsSchema),
  replaceStops,
);
companyRouter.put(
  '/routes/:id/schedules',
  validateParams(idParamSchema),
  validateBody(upsertScheduleSchema),
  upsertSchedules,
);

companyRouter.get('/drivers', listDrivers);
companyRouter.post('/drivers', validateBody(createDriverSchema), createDriver);
companyRouter.patch(
  '/drivers/:id',
  validateParams(idParamSchema),
  validateBody(updateDriverSchema),
  updateDriver,
);

companyRouter.get('/trips/live', liveTrips);

// Reusa el mismo arbol publico: el panel necesita las mismas regiones/zonas
// para el selector del RouteForm.
companyRouter.get('/regions', listRegions);
companyRouter.post(
  '/regions/:regionId/zones',
  validateParams(regionIdParamSchema),
  validateBody(createZoneSchema),
  createZone,
);
