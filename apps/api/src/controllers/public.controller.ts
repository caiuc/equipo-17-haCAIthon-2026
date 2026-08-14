import type { RequestHandler } from 'express';
import { HttpError } from '../middlewares/error.js';

// STUB: lo implementa el agente responsable de esta area.
const notImplemented: RequestHandler = () => {
  throw new HttpError(501, 'No implementado');
};

export const searchRoutes: RequestHandler = notImplemented;
export const getRoute: RequestHandler = notImplemented;
