import type { RequestHandler } from 'express';
import { validatedParams, validatedQuery } from '../middlewares/validate.js';
import { getRouteLiveState } from '../services/live.service.js';

/** Vista en vivo del pasajero. Publica: quien espera en el paradero no tiene cuenta. */
export const getRouteLive: RequestHandler = async (_req, res) => {
  const { id } = validatedParams<{ id: string }>(res);
  const { stopId } = validatedQuery<{ stopId?: string }>(res);

  const live = await getRouteLiveState(id, stopId);

  // Un dato de frescura cacheado es una contradiccion en sus propios terminos.
  res.set('Cache-Control', 'no-store');
  res.json(live);
};
