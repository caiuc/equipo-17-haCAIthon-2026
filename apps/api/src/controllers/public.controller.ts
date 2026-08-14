import type { RequestHandler } from 'express';
import { validatedParams, validatedQuery } from '../middlewares/validate.js';
import * as publicRoutes from '../services/publicRoute.service.js';

// Express 5 propaga solo los errores de un handler async: nada de try/catch.

export const searchRoutes: RequestHandler = async (_req, res) => {
  // Lo que dejo validateQuery(searchRoutesQuerySchema) en res.locals.
  const { q } = validatedQuery<{ q?: string }>(res);
  res.json(await publicRoutes.searchRoutes(q));
};

export const getRoute: RequestHandler = async (_req, res) => {
  const { id } = validatedParams<{ id: string }>(res);
  res.json(await publicRoutes.getRouteDetail(id));
};
