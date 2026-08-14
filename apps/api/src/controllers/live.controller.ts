import type { RequestHandler } from 'express';
import type { LiveBusesQuery } from '@equipo17/shared';
import { validatedParams, validatedQuery } from '../middlewares/validate.js';
import { getLiveBuses as getLiveBusesState, getRouteLiveState } from '../services/live.service.js';

/** Vista en vivo del pasajero. Publica: quien espera en el paradero no tiene cuenta. */
export const getRouteLive: RequestHandler = async (_req, res) => {
  const { id } = validatedParams<{ id: string }>(res);
  const { stopId } = validatedQuery<{ stopId?: string }>(res);

  const live = await getRouteLiveState(id, stopId);

  // Un dato de frescura cacheado es una contradiccion en sus propios terminos.
  res.set('Cache-Control', 'no-store');
  res.json(live);
};

/** Todas las micros del mapa, de todas las empresas. Un solo poll para la vista. */
export const getLiveBuses: RequestHandler = async (_req, res) => {
  const query = validatedQuery<LiveBusesQuery>(res);

  const live = await getLiveBusesState(query);

  res.set('Cache-Control', 'no-store');
  res.json(live);
};
