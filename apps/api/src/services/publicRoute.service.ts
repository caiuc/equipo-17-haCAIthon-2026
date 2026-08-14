import {
  assetSlugOr,
  type Fare,
  type PassengerType,
  type PublicCompany,
  type RouteDetail,
  type RouteSummary,
} from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middlewares/error.js';

/**
 * Lectura publica de recorridos: lo que ve alguien parado en un paradero, sin
 * cuenta ni token. Solo expone recorridos activos de empresas ACTIVE; una
 * empresa suspendida desaparece del mapa publico sin borrar sus datos.
 */

const companySelect = {
  company: { select: { id: true, slug: true, name: true, color: true, assetSlug: true } },
  zone: { select: { id: true, name: true } },
} as const;

/** 0 a 3 filas. Vacio = tarifa no publicada, que NO es lo mismo que gratis. */
const fareSelect = {
  fares: { select: { passengerType: true, amountClp: true }, orderBy: { amountClp: 'desc' } },
} as const;

type RouteWithCompany = {
  id: string;
  name: string;
  code: string;
  originName: string;
  destinationName: string;
  company: { id: string; slug: string; name: string; color: string; assetSlug: string };
  zone: { id: string; name: string } | null;
  fares: { passengerType: PassengerType; amountClp: number }[];
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
  company: {
    id: route.company.id,
    slug: route.company.slug,
    name: route.company.name,
    color: route.company.color,
    assetSlug: assetSlugOr(route.company.assetSlug),
  },
  // null = zona pendiente de asignar por la empresa, nunca se infiere.
  zone: route.zone ? { id: route.zone.id, name: route.zone.name } : null,
  // Se pasan tal cual: la ausencia de una fila es informacion, no un hueco que
  // haya que rellenar con cero.
  fares: route.fares.map((fare): Fare => ({
    passengerType: fare.passengerType,
    amountClp: fare.amountClp,
  })),
  activeBuses,
});

export type SearchRoutesFilters = {
  q?: string;
  /** OR entre empresas, AND con el resto de los filtros. */
  companyId?: string[];
  zoneId?: string;
};

/**
 * Busqueda por nombre o codigo, insensible a mayusculas y acentos de teclado
 * (el usuario escribe "vicuna" o "VIC"), mas los filtros opcionales de empresa
 * y zona. Sin filtros devuelve el catalogo completo. Cero resultados es una
 * lista vacia, no un 404: "no encontre ese recorrido" es una respuesta valida
 * de la busqueda, no un error.
 */
export const searchRoutes = async (filters: SearchRoutesFilters = {}): Promise<RouteSummary[]> => {
  const term = filters.q?.trim();

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
      ...(filters.companyId?.length ? { companyId: { in: filters.companyId } } : {}),
      ...(filters.zoneId ? { zoneId: filters.zoneId } : {}),
    },
    include: { ...companySelect, ...fareSelect },
    orderBy: [{ code: 'asc' }],
  });

  const counts = await activeBusesByRoute(routes.map((route) => route.id));

  return routes.map((route) => toSummary(route, counts.get(route.id) ?? 0));
};

/**
 * Ficha publica de cada empresa.
 *
 * El telefono no es un adorno: es la respuesta de respaldo cuando no hay
 * ninguna micro transmitiendo. "Llamalos" es mejor que una pantalla vacia, y
 * por eso el campo existe en el esquema.
 */
export const listPublicCompanies = async (): Promise<PublicCompany[]> => {
  const companies = await prisma.company.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      slug: true,
      name: true,
      color: true,
      assetSlug: true,
      kind: true,
      phone: true,
      website: true,
      sourceUrl: true,
      sourceCheckedAt: true,
      _count: { select: { routes: { where: { active: true } } } },
    },
    orderBy: { name: 'asc' },
  });

  return companies.map((company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
    color: company.color,
    assetSlug: assetSlugOr(company.assetSlug),
    kind: company.kind,
    phone: company.phone,
    website: company.website,
    sourceUrl: company.sourceUrl,
    sourceCheckedAt: company.sourceCheckedAt?.toISOString() ?? null,
    routeCount: company._count.routes,
  }));
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
      ...fareSelect,
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
