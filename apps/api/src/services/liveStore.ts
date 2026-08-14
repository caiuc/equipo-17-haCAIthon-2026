import {
  FRESHNESS_INTERMITTENT_MS,
  FRESHNESS_LIVE_MS,
  POSITION_SAMPLE_INTERVAL_MS,
  type Freshness,
} from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';

export type LivePosition = {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recordedAt: Date;
};

export type LiveTrip = LivePosition & {
  tripId: string;
  routeId: string;
  companyId: string;
  driverId: string;
  driverName: string;
  /** Cuando se bajo la ultima posicion a Postgres. */
  lastPersistedAt: number;
};

/**
 * Ultima posicion conocida de cada turno activo, en memoria.
 *
 * Existe para que el polling de los pasajeros no golpee Postgres en cada
 * consulta: a la base solo baja una muestra cada POSITION_SAMPLE_INTERVAL_MS.
 * Es estado volatil a proposito; la verdad duradera vive en la tabla Position.
 */
const trips = new Map<string, LiveTrip>();

export const upsertLiveTrip = (trip: LiveTrip): void => {
  trips.set(trip.tripId, trip);
};

export const getLiveTrip = (tripId: string): LiveTrip | undefined => trips.get(tripId);

export const removeLiveTrip = (tripId: string): void => {
  trips.delete(tripId);
};

export const getLiveTripsByRoute = (routeId: string): LiveTrip[] =>
  [...trips.values()].filter((trip) => trip.routeId === routeId);

export const getLiveTripsByCompany = (companyId: string): LiveTrip[] =>
  [...trips.values()].filter((trip) => trip.companyId === companyId);

export const clearLiveTrips = (): void => {
  trips.clear();
};

/**
 * Estado de frescura de una posicion (§4.5).
 * Se calcula en cada lectura, asi que una micro que dejo de transmitir se
 * degrada sola a NO_SIGNAL sin necesidad de ningun proceso periodico.
 */
export const freshnessOf = (recordedAt: Date, now = Date.now()): Freshness => {
  const age = now - recordedAt.getTime();
  if (age <= FRESHNESS_LIVE_MS) return 'LIVE';
  if (age <= FRESHNESS_INTERMITTENT_MS) return 'INTERMITTENT';
  return 'NO_SIGNAL';
};

export const ageSecondsOf = (recordedAt: Date, now = Date.now()): number =>
  Math.max(0, Math.round((now - recordedAt.getTime()) / 1000));

/** true si toca bajar esta posicion a Postgres. */
export const shouldPersist = (trip: LiveTrip, now = Date.now()): boolean =>
  now - trip.lastPersistedAt >= POSITION_SAMPLE_INTERVAL_MS;

/**
 * Repuebla el store desde la base al arrancar el proceso.
 * Sin esto, un reinicio en plena Feria dejaria a todas las micros en curso
 * invisibles hasta su siguiente ping.
 */
export const hydrateLiveTrips = async (): Promise<number> => {
  const active = await prisma.trip.findMany({
    where: { status: 'IN_TRANSIT' },
    include: {
      driver: { select: { name: true } },
      positions: { orderBy: { recordedAt: 'desc' }, take: 1 },
    },
  });

  for (const trip of active) {
    const last = trip.positions[0];
    if (!last) continue;
    trips.set(trip.id, {
      tripId: trip.id,
      routeId: trip.routeId,
      companyId: trip.companyId,
      driverId: trip.driverId,
      driverName: trip.driver.name,
      lat: last.lat,
      lng: last.lng,
      speed: last.speed,
      heading: last.heading,
      recordedAt: last.recordedAt,
      lastPersistedAt: last.recordedAt.getTime(),
    });
  }

  return trips.size;
};
