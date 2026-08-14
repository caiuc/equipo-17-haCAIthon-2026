import type { LatLng, LiveBus, LiveRoute, Occupancy } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { haversineMeters } from '../lib/geo.js';
import { HttpError } from '../middlewares/error.js';
import { ageSecondsOf, freshnessOf, getLiveTripsByRoute, type LiveTrip } from './liveStore.js';
import { resolveOccupancyMany } from './occupancy.service.js';

/** Sin reportes vigentes no se inventa un estado: se declara desconocido. */
const UNKNOWN_OCCUPANCY: Occupancy = {
  status: 'UNKNOWN',
  source: null,
  reportCount: 0,
  updatedAt: null,
};

const toLiveBus = (
  trip: LiveTrip,
  stop: LatLng | null,
  occupancy: Occupancy,
  now: number,
): LiveBus => {
  const freshness = freshnessOf(trip.recordedAt, now);

  // La distancia se omite cuando la posicion ya no es confiable: medir contra un
  // punto viejo daria una falsa precision que puede hacer perder la micro.
  const distanceMeters =
    stop && freshness !== 'NO_SIGNAL'
      ? haversineMeters({ lat: trip.lat, lng: trip.lng }, stop)
      : null;

  return {
    tripId: trip.tripId,
    routeId: trip.routeId,
    driverName: trip.driverName,
    position: { lat: trip.lat, lng: trip.lng },
    speed: trip.speed,
    heading: trip.heading,
    recordedAt: trip.recordedAt.toISOString(),
    ageSeconds: ageSecondsOf(trip.recordedAt, now),
    freshness,
    distanceMeters,
    occupancy,
  };
};

/** Primero la micro mas util: la mas cercana al paradero, o la mas reciente. */
const byRelevance = (a: LiveBus, b: LiveBus): number => {
  if (a.distanceMeters !== null && b.distanceMeters !== null) {
    return a.distanceMeters - b.distanceMeters;
  }
  if (a.distanceMeters !== null) return -1;
  if (b.distanceMeters !== null) return 1;
  return a.ageSeconds - b.ageSeconds;
};

export const getRouteLiveState = async (routeId: string, stopId?: string): Promise<LiveRoute> => {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, name: true },
  });
  if (!route) throw new HttpError(404, 'Recorrido no encontrado');

  let stop: LatLng | null = null;
  if (stopId) {
    const found = await prisma.routeStop.findUnique({
      where: { id: stopId },
      select: { routeId: true, lat: true, lng: true },
    });
    if (!found || found.routeId !== routeId) {
      throw new HttpError(400, 'El paradero no pertenece a este recorrido');
    }
    stop = { lat: found.lat, lng: found.lng };
  }

  const trips = getLiveTripsByRoute(routeId);
  const now = Date.now();

  // Una sola consulta de ocupacion para todas las micros del recorrido: este
  // endpoint lo golpea cada pasajero cada pocos segundos.
  const occupancies = await resolveOccupancyMany(trips.map((trip) => trip.tripId));

  const buses = trips
    .map((trip) => toLiveBus(trip, stop, occupancies.get(trip.tripId) ?? UNKNOWN_OCCUPANCY, now))
    .sort(byRelevance);

  return {
    routeId: route.id,
    routeName: route.name,
    // El cliente calcula edades contra este reloj, nunca contra el del celular.
    serverTime: new Date(now).toISOString(),
    stopId: stopId ?? null,
    buses,
    outOfService: buses.length === 0,
  };
};
