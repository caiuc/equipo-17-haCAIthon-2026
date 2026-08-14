import type { RequestHandler } from 'express';
import { HttpError } from '../middlewares/error.js';

// STUB: lo implementa el agente responsable de esta area.
const notImplemented: RequestHandler = () => {
  throw new HttpError(501, 'No implementado');
};

export const listRoutes: RequestHandler = notImplemented;
export const createRoute: RequestHandler = notImplemented;
export const getRoute: RequestHandler = notImplemented;
export const updateRoute: RequestHandler = notImplemented;
export const deleteRoute: RequestHandler = notImplemented;
export const replaceStops: RequestHandler = notImplemented;
export const upsertSchedules: RequestHandler = notImplemented;
export const listDrivers: RequestHandler = notImplemented;
export const createDriver: RequestHandler = notImplemented;
export const updateDriver: RequestHandler = notImplemented;
export const liveTrips: RequestHandler = notImplemented;
