import type { RouteDetail, RouteSummary } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middlewares/error.js';

/**
 * Lectura publica de recorridos: lo que ve alguien parado en un paradero, sin
 * cuenta ni token. Solo expone recorridos activos de empresas ACTIVE; una
 * empresa suspendida desaparece del mapa publico sin borrar sus datos.
 */

const companySelect = { company: { select: { name: true } } } as const;

type RouteWithCompany = {
  id: string;
  name: string;
  code: string;
  originName: string;
  destinationName: string;
  company: { name: string };
};

/**
 * activeBuses = turnos IN_TRANSIT del recorrido.
 *
 * Se cuenta en la tabla Trip y no en liveStore a proposito: el store en memoria
 * solo conoce turnos que ya enviaron al menos una posicion y se vacia al
 * reiniciar el proceso, asi que una micro recien iniciada o un servidor recien
 * levantado responderian "no viene ninguna" cuando si viene. Trip es la verdad
 * duradera. La frescura de cada micro la resuelve /routes/:id/live, que si mira
 * el store; aca solo se responde el "hay o no hay".
 *
 * Un solo groupBy para toda la pagina de resultados evita el N+1.
 */
const activeBusesByRoute = async (routeIds: string[]): Promise<Map<string, number>> => {
  if (routeIds.length === 0) return new Map();

  const grouped = await prisma.trip.groupBy({
    by: ['routeId'],
    where: { routeId: { in: routeIds }, status: 'IN_TRANSIT' },
    _count: { _all: true },
  });

  return new Map(grouped.map((row) => [row.routeId, row._count._all]));
};

const toSummary = (route: RouteWithCompany, activeBuses: number): RouteSummary => ({
  id: route.id,
  name: route.name,
  code: route.code,
  originName: route.originName,
  destinationName: route.destinationName,
  companyName: route.company.name,
  activeBuses,
});

/**
 * Busqueda por nombre o codigo, insensible a mayusculas y acentos de teclado
 * (el usuario escribe "vicuna" o "VIC"). Sin `q` devuelve el catalogo completo.
 * Cero resultados es una lista vacia, no un 404: "no encontre ese recorrido" es
 * una respuesta valida de la busqueda, no un error.
 */
export const searchRoutes = async (q?: string): Promise<RouteSummary[]> => {
  const term = q?.trim();

  const routes = await prisma.route.findMany({
    where: {
      active: true,
      company: { status: 'ACTIVE' },
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { code: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: companySelect,
    orderBy: [{ code: 'asc' }],
  });

  const counts = await activeBusesByRoute(routes.map((route) => route.id));

  return routes.map((route) => toSummary(route, counts.get(route.id) ?? 0));
};

/**
 * Detalle: recorrido + paraderos en orden + horarios de referencia.
 * Un recorrido de empresa suspendida se comporta como inexistente (404).
 */
export const getRouteDetail = async (id: string): Promise<RouteDetail> => {
  const route = await prisma.route.findFirst({
    where: { id, company: { status: 'ACTIVE' } },
    include: {
      ...companySelect,
      // El orden explicito es lo que permite razonar sobre el avance de la micro.
      stops: { orderBy: { stopOrder: 'asc' } },
      schedules: { orderBy: { dayType: 'asc' } },
    },
  });

  if (!route) throw new HttpError(404, 'Recorrido no encontrado');

  const counts = await activeBusesByRoute([route.id]);

  return {
    ...toSummary(route, counts.get(route.id) ?? 0),
    stops: route.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      stopOrder: stop.stopOrder,
    })),
    schedules: route.schedules.map((schedule) => ({
      dayType: schedule.dayType,
      firstDeparture: schedule.firstDeparture,
      lastDeparture: schedule.lastDeparture,
    })),
  };
};
