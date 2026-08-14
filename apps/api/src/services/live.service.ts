import {
  assetSlugOr,
  type Freshness,
  type LatLng,
  type LiveBus,
  type LiveBuses,
  type LiveBusesQuery,
  type LiveRoute,
  type Occupancy,
} from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { haversineMeters } from '../lib/geo.js';
import { HttpError } from '../middlewares/error.js';
import {
  ageSecondsOf,
  freshnessOf,
  getAllLiveTrips,
  getLiveTripsByRoute,
  getLiveTripsInBounds,
  type LiveTrip,
} from './liveStore.js';
import { resolveOccupancyMany } from './occupancy.service.js';
import { getCatalog, type RouteCatalogEntry } from './companyCatalog.service.js';

/** Sin reportes vigentes no se inventa un estado: se declara desconocido. */
const UNKNOWN_OCCUPANCY: Occupancy = {
  status: 'UNKNOWN',
  source: null,
  reportCount: 0,
  updatedAt: null,
};

const toLiveBus = (
  trip: LiveTrip,
  entry: RouteCatalogEntry,
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
    routeCode: entry.routeCode,
    routeName: entry.routeName,
    // El sprite del vehiculo manda sobre el de la empresa cuando existe: una
    // empresa puede tener un minibus distinto al resto de su flota.
    company: trip.busAssetSlug
      ? { ...entry.company, assetSlug: assetSlugOr(trip.busAssetSlug) }
      : entry.company,
    plate: trip.busPlate,
    seats: trip.busSeats,
    fareAdultClp: entry.fareAdultClp,
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

/**
 * Solo el nombre de pila.
 *
 * La vista de un recorrido muestra el nombre completo del chofer y tiene
 * sentido: es una micro, identificable. Pero /live/buses devuelve TODAS las
 * micros de TODAS las empresas en una sola respuesta publica, consultable cada
 * pocos segundos: ahi el nombre completo se vuelve un padron de choferes
 * descargable. Es dato personal (Ley 19.628) y el mapa no lo necesita.
 */
const soloNombreDePila = (nombre: string): string => nombre.trim().split(/\s+/)[0] ?? nombre;

/** Menor es mejor. Un dato viejo nunca puede encabezar una lista. */
const freshnessRank: Record<Freshness, number> = {
  LIVE: 0,
  INTERMITTENT: 1,
  NO_SIGNAL: 2,
  OUT_OF_SERVICE: 3,
};

/**
 * Primero la micro mas util. La frescura pesa MAS que la distancia: una micro
 * sin senal cuya ultima posicion quedo cerca del paradero no es mejor
 * informacion que una micro en vivo un poco mas lejos -- es informacion vieja
 * disfrazada de cercania, que es justo lo que el proyecto existe para no hacer.
 */
const byRelevance = (a: LiveBus, b: LiveBus): number => {
  const rank = freshnessRank[a.freshness] - freshnessRank[b.freshness];
  if (rank !== 0) return rank;

  if (a.distanceMeters !== null && b.distanceMeters !== null) {
    return a.distanceMeters - b.distanceMeters;
  }
  if (a.distanceMeters !== null) return -1;
  if (b.distanceMeters !== null) return 1;
  return a.ageSeconds - b.ageSeconds;
};

export const getRouteLiveState = async (routeId: string, stopId?: string): Promise<LiveRoute> => {
  const route = await prisma.route.findFirst({
    // El filtro por empresa ACTIVE va aca y no solo en publicRoute.service: sin
    // el, un recorrido de empresa suspendida daba 404 en /api/routes/:id y 200
    // con micros en /api/routes/:id/live. Dos verdades sobre el mismo dato.
    where: { id: routeId, active: true, company: { status: 'ACTIVE' } },
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
  const [occupancies, catalog] = await Promise.all([
    resolveOccupancyMany(trips.map((trip) => trip.tripId)),
    getCatalog(now),
  ]);

  const buses = trips
    .flatMap((trip) => {
      const entry = catalog.get(trip.routeId);
      // Sin entrada de catalogo el recorrido esta inactivo o su empresa
      // suspendida: no se dibuja, pero tampoco se inventa una empresa vacia.
      if (!entry) return [];
      return [
        toLiveBus(trip, entry, stop, occupancies.get(trip.tripId) ?? UNKNOWN_OCCUPANCY, now),
      ];
    })
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

/**
 * Todas las micros vivas del mapa, de todas las empresas.
 *
 * Es el endpoint que hace posible la vista tipo Uber: un solo poll cada
 * LIVE_POLL_INTERVAL_MS en vez de una consulta por recorrido. Lee del store en
 * memoria y del catalogo cacheado, asi que su costo en Postgres es una sola
 * consulta (la de ocupacion), independiente de cuantas micros haya.
 */
export const getLiveBuses = async (params: LiveBusesQuery): Promise<LiveBuses> => {
  const { bbox, companyId, routeId, stopId, limit } = params;

  let stop: LatLng | null = null;
  if (stopId) {
    const found = await prisma.routeStop.findUnique({
      where: { id: stopId },
      select: { lat: true, lng: true },
    });
    // Aca el paradero es solo un punto de referencia del mapa: a diferencia de
    // /routes/:id/live, no se exige que pertenezca a un recorrido en particular.
    if (!found) throw new HttpError(404, 'Paradero no encontrado');
    stop = { lat: found.lat, lng: found.lng };
  }

  const now = Date.now();
  const catalog = await getCatalog(now);

  const candidatos = (bbox ? getLiveTripsInBounds(bbox) : getAllLiveTrips())
    .filter((trip) => (companyId ? trip.companyId === companyId : true))
    .filter((trip) => (routeId ? trip.routeId === routeId : true))
    // Empresa suspendida o recorrido dado de baja: fuera del mapa aunque la
    // micro siga viva en memoria.
    .filter((trip) => catalog.has(trip.routeId));

  // Se ordena ANTES de recortar, o el limite dejaria fuera justo las mas
  // relevantes y se quedaria con las primeras del Map, que no significan nada.
  const occupancies = await resolveOccupancyMany(candidatos.map((trip) => trip.tripId));

  const todos = candidatos
    .flatMap((trip) => {
      const entry = catalog.get(trip.routeId);
      if (!entry) return [];
      return [
        toLiveBus(trip, entry, stop, occupancies.get(trip.tripId) ?? UNKNOWN_OCCUPANCY, now),
      ];
    })
    .sort(byRelevance);

  const buses = todos
    .slice(0, limit)
    .map((bus) => ({ ...bus, driverName: soloNombreDePila(bus.driverName) }));

  return {
    serverTime: new Date(now).toISOString(),
    stopId: stopId ?? null,
    buses,
    total: todos.length,
    truncated: todos.length > buses.length,
  };
};
