import type { RequestHandler } from 'express';
import { HttpError } from '../middlewares/error.js';

// STUB: lo implementa el agente responsable de esta area.
const notImplemented: RequestHandler = () => {
  throw new HttpError(501, 'No implementado');
};

export const listRoutes: RequestHandler = notImplemented;
export const activeTrip: RequestHandler = notImplemented;
export const startTrip: RequestHandler = notImplemented;
export const endTrip: RequestHandler = notImplemented;
export const reportOccupancy: RequestHandler = notImplemented;
