import type { RequestHandler } from 'express';
import { validatedBody, validatedParams } from '../middlewares/validate.js';
import { HttpError } from '../middlewares/error.js';
import { recordPositions, type PostPositionsBody } from '../services/position.service.js';

/**
 * Ingesta de posiciones del chofer. Responde 202 porque el trabajo real (bajar
 * la muestra a Postgres) es diferido: al chofer solo le interesa saber que su
 * senal llego, que es lo que enciende su indicador "transmitiendo".
 */
export const postPositions: RequestHandler = async (req, res) => {
  if (!req.auth) throw new HttpError(401, 'No autenticado');

  const { id } = validatedParams<{ id: string }>(res);
  const body = validatedBody<PostPositionsBody>(req);

  const { receivedAt, accepted } = await recordPositions({
    tripId: id,
    driverId: req.auth.sub,
    body,
  });

  res.status(202).json({ ok: true, receivedAt, accepted });
};
