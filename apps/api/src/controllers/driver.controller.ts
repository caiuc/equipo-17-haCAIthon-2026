import type { RequestHandler } from 'express';
import { companyIdOf } from '../middlewares/auth.js';
import { HttpError } from '../middlewares/error.js';
import { validatedBody, validatedParams } from '../middlewares/validate.js';
import * as tripService from '../services/trip.service.js';
import { saveOccupancyReport } from '../services/occupancy.service.js';

/** El id del chofer sale del token, nunca del body. */
const driverIdOf = (req: { auth?: { sub: string } }): string => {
  const driverId = req.auth?.sub;
  if (!driverId) throw new HttpError(401, 'No autenticado');
  return driverId;
};

export const listRoutes: RequestHandler = async (req, res) => {
  const routes = await tripService.listCompanyRoutes(companyIdOf(req));
  res.json({ routes });
};

export const activeTrip: RequestHandler = async (req, res) => {
  const trip = await tripService.getActiveTrip(driverIdOf(req));
  res.json({ trip });
};

export const startTrip: RequestHandler = async (req, res) => {
  const { routeId } = validatedBody<{ routeId: string }>(req);
  const trip = await tripService.startTrip({
    driverId: driverIdOf(req),
    companyId: companyIdOf(req),
    routeId,
  });
  res.status(201).json({ trip });
};

export const endTrip: RequestHandler = async (req, res) => {
  const { id } = validatedParams<{ id: string }>(res);
  const trip = await tripService.endTrip({ driverId: driverIdOf(req), tripId: id });
  res.json({ trip });
};

export const reportOccupancy: RequestHandler = async (req, res) => {
  const { id } = validatedParams<{ id: string }>(res);
  const { full } = validatedBody<{ full: boolean }>(req);
  const driverId = driverIdOf(req);

  await tripService.requireOwnActiveTrip({ driverId, tripId: id });
  const occupancy = await saveOccupancyReport({
    tripId: id,
    reporterKey: `driver:${driverId}`,
    source: 'DRIVER',
    full,
  });

  res.json({ occupancy });
};
