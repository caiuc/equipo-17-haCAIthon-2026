import type { Request, RequestHandler } from 'express';
import { HttpError } from '../middlewares/error.js';
import { validatedBody, validatedParams } from '../middlewares/validate.js';
import { requireInTransitTrip } from '../services/trip.service.js';
import { saveOccupancyReport } from '../services/occupancy.service.js';

/**
 * Identidad del reportante. La cuenta manda sobre el dispositivo; sin ninguna
 * de las dos no hay forma de garantizar un voto por persona, y sin eso el
 * contador colaborativo no significa nada.
 */
const reporterKeyOf = (req: Request): string => {
  if (req.auth?.sub) return `user:${req.auth.sub}`;

  const header = req.headers['x-device-id'];
  const deviceId = (Array.isArray(header) ? header[0] : header)?.trim();
  if (deviceId) return `device:${deviceId}`;

  throw new HttpError(400, 'Falta el header x-device-id para identificar el reporte');
};

export const reportOccupancy: RequestHandler = async (req, res) => {
  const { id } = validatedParams<{ id: string }>(res);
  const { full } = validatedBody<{ full: boolean }>(req);
  const reporterKey = reporterKeyOf(req);

  // Solo tiene sentido reportar sobre una micro que va en ruta ahora.
  await requireInTransitTrip(id);

  const occupancy = await saveOccupancyReport({
    tripId: id,
    reporterKey,
    source: 'PASSENGER',
    full,
  });

  res.json({ occupancy });
};
