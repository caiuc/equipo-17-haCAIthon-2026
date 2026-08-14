import type { Trip as TripDto } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middlewares/error.js';
import { removeLiveTrip } from './liveStore.js';

type TripWithRoute = {
  id: string;
  routeId: string;
  driverId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  route: { name: string };
};

const tripInclude = { route: { select: { name: true } } } as const;

const toTripDto = (trip: TripWithRoute): TripDto => ({
  id: trip.id,
  routeId: trip.routeId,
  routeName: trip.route.name,
  driverId: trip.driverId,
  status: trip.status as TripDto['status'],
  startedAt: trip.startedAt.toISOString(),
  endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
});

/** Recorridos activos de la empresa del chofer: lo que puede elegir al iniciar. */
export const listCompanyRoutes = async (companyId: string) => {
  const routes = await prisma.route.findMany({
    where: { companyId, active: true },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      originName: true,
      destinationName: true,
    },
  });

  return routes;
};

export const getActiveTrip = async (driverId: string): Promise<TripDto | null> => {
  const trip = await prisma.trip.findFirst({
    where: { driverId, status: 'IN_TRANSIT' },
    include: tripInclude,
  });

  return trip ? toTripDto(trip) : null;
};

export const startTrip = async (input: {
  driverId: string;
  companyId: string;
  routeId: string;
}): Promise<TripDto> => {
  const { driverId, companyId, routeId } = input;

  // El recorrido se busca SIEMPRE acotado a la empresa del token: uno de otra
  // empresa no debe distinguirse de uno inexistente.
  const route = await prisma.route.findFirst({
    where: { id: routeId, companyId },
    select: { id: true },
  });
  if (!route) throw new HttpError(404, 'Recorrido no encontrado');

  // Un chofer va en una micro a la vez: dos turnos abiertos significarian dos
  // puntos en el mapa para la misma persona.
  const active = await prisma.trip.findFirst({
    where: { driverId, status: 'IN_TRANSIT' },
    include: tripInclude,
  });
  if (active) {
    throw new HttpError(409, 'Ya tienes un turno en curso', { trip: toTripDto(active) });
  }

  const trip = await prisma.trip.create({
    data: { routeId, driverId, companyId, status: 'IN_TRANSIT' },
    include: tripInclude,
  });

  return toTripDto(trip);
};

export const endTrip = async (input: { driverId: string; tripId: string }): Promise<TripDto> => {
  const { driverId, tripId } = input;

  const existing = await prisma.trip.findFirst({
    where: { id: tripId, driverId },
    include: tripInclude,
  });
  if (!existing) throw new HttpError(404, 'Turno no encontrado');
  if (existing.status !== 'IN_TRANSIT') throw new HttpError(409, 'El turno ya esta finalizado');

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: { status: 'COMPLETED', endedAt: new Date() },
    include: tripInclude,
  });

  // Sacarlo de memoria es parte de finalizar: si no, el pasajero seguiria viendo
  // una micro que ya no esta en ruta hasta que expirara sola.
  removeLiveTrip(tripId);

  return toTripDto(trip);
};

/** Turno activo del chofer, o corta. Lo usan los reportes de ocupacion. */
export const requireOwnActiveTrip = async (input: {
  driverId: string;
  tripId: string;
}): Promise<string> => {
  const trip = await prisma.trip.findFirst({
    where: { id: input.tripId, driverId: input.driverId, status: 'IN_TRANSIT' },
    select: { id: true },
  });
  if (!trip) throw new HttpError(404, 'Turno activo no encontrado');
  return trip.id;
};

/** Turno en curso (para el reporte anonimo del pasajero), o corta. */
export const requireInTransitTrip = async (tripId: string): Promise<string> => {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, status: true },
  });
  if (!trip) throw new HttpError(404, 'Turno no encontrado');
  if (trip.status !== 'IN_TRANSIT') {
    throw new HttpError(409, 'El turno ya no esta en ruta');
  }
  return trip.id;
};
