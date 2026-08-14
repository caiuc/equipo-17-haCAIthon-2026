import type { PositionInput } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middlewares/error.js';
import { getLiveTrip, shouldPersist, upsertLiveTrip, type LiveTrip } from './liveStore.js';

/** El body del chofer: una posicion suelta o el lote que acumulo sin senal. */
export type PostPositionsBody = PositionInput | { positions: PositionInput[] };

/**
 * Tolerancia de reloj hacia adelante. Un celular con la hora mal configurada
 * mandaria posiciones "del futuro" que se verian eternamente frescas: eso
 * envenena la frescura, que es justo el dato que el sistema promete no mentir.
 */
const MAX_CLOCK_SKEW_MS = 60_000;

export type RecordPositionsResult = {
  receivedAt: string;
  accepted: number;
};

type Sample = {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recordedAt: Date;
};

/** Normaliza el union del body a un array plano. */
export const toPositionArray = (body: PostPositionsBody): PositionInput[] =>
  'positions' in body ? body.positions : [body];

/**
 * Convierte latitude/longitude (Geolocation API) a lat/lng (Google Maps), que
 * es el formato que usa el resto del sistema, y descarta lo que venga del futuro.
 */
const toSamples = (positions: PositionInput[], now: number): Sample[] =>
  positions
    .map((position) => ({
      lat: position.latitude,
      lng: position.longitude,
      speed: position.speed ?? null,
      heading: position.heading ?? null,
      recordedAt: position.timestamp ? new Date(position.timestamp) : new Date(now),
    }))
    .filter((sample) => sample.recordedAt.getTime() <= now + MAX_CLOCK_SKEW_MS)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

export const recordPositions = async (params: {
  tripId: string;
  driverId: string;
  body: PostPositionsBody;
}): Promise<RecordPositionsResult> => {
  const { tripId, driverId, body } = params;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      routeId: true,
      companyId: true,
      driverId: true,
      status: true,
      driver: { select: { name: true } },
      // Sale gratis en la consulta que este camino ya hacia. Todo lo demas que
      // el mapa necesita (empresa, color, tarifa) vive en companyCatalog, que se
      // cachea: meterlo aca encareceria el ping del chofer, que corre cada
      // cuatro segundos por micro.
      bus: { select: { plate: true, seats: true, assetSlug: true } },
    },
  });

  // Un turno ajeno se responde como inexistente: no se le confirma a nadie que
  // el id de otro chofer existe.
  if (!trip || trip.driverId !== driverId) throw new HttpError(404, 'Turno no encontrado');
  if (trip.status !== 'IN_TRANSIT') throw new HttpError(409, 'El turno ya no esta en transito');

  const now = Date.now();
  const samples = toSamples(toPositionArray(body), now);
  const receivedAt = new Date(now).toISOString();

  // Todas las muestras venian del futuro: se acusa recibo sin ensuciar el estado.
  const last = samples.at(-1);
  if (!last) return { receivedAt, accepted: 0 };

  const previous = getLiveTrip(tripId);
  const liveTrip: LiveTrip = {
    tripId: trip.id,
    routeId: trip.routeId,
    companyId: trip.companyId,
    driverId: trip.driverId,
    driverName: trip.driver.name,
    busPlate: trip.bus?.plate ?? null,
    busSeats: trip.bus?.seats ?? null,
    busAssetSlug: trip.bus?.assetSlug ?? null,
    lat: last.lat,
    lng: last.lng,
    speed: last.speed,
    heading: last.heading,
    recordedAt: last.recordedAt,
    lastPersistedAt: previous?.lastPersistedAt ?? 0,
  };

  // A Postgres solo baja una muestra cada POSITION_SAMPLE_INTERVAL_MS; el resto
  // del recorrido vive unicamente en memoria.
  if (shouldPersist(liveTrip, now)) {
    await prisma.position.create({
      data: {
        tripId: trip.id,
        lat: last.lat,
        lng: last.lng,
        speed: last.speed,
        heading: last.heading,
        recordedAt: last.recordedAt,
      },
    });
    liveTrip.lastPersistedAt = now;
  }

  upsertLiveTrip(liveTrip);

  return { receivedAt, accepted: samples.length };
};
