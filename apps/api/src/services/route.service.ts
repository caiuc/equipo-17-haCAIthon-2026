import type { CreateRouteInput, DayType, UpdateRouteInput } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middlewares/error.js';

export type StopInput = {
  name: string;
  lat: number;
  lng: number;
};

export type ScheduleInput = {
  dayType: DayType;
  firstDeparture: string;
  lastDeparture: string;
};

// Los paraderos siempre viajan ordenados: el stopOrder es lo que da sentido al
// recorrido y el cliente no deberia tener que reordenar nada.
const routeInclude = {
  stops: { orderBy: { stopOrder: 'asc' } },
  schedules: { orderBy: { dayType: 'asc' } },
} as const;

/**
 * Aislamiento multitenant: todas estas funciones reciben el companyId del token
 * y lo aplican como filtro. Un recorrido de otra empresa se comporta como
 * inexistente (404) para no confirmar que existe.
 */
export const listRoutes = async (companyId: string) =>
  prisma.route.findMany({
    where: { companyId },
    include: routeInclude,
    orderBy: { code: 'asc' },
  });

export const getRoute = async (companyId: string, id: string) => {
  const route = await prisma.route.findFirst({
    where: { id, companyId },
    include: routeInclude,
  });
  if (!route) throw new HttpError(404, 'Recorrido no encontrado');
  return route;
};

/** Verifica pertenencia sin traer relaciones: es el chequeo previo a escribir. */
const assertOwnedRoute = async (companyId: string, id: string): Promise<void> => {
  const route = await prisma.route.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!route) throw new HttpError(404, 'Recorrido no encontrado');
};

export const createRoute = async (companyId: string, input: CreateRouteInput) => {
  // El code es unico dentro de la empresa (@@unique([companyId, code])).
  const clash = await prisma.route.findFirst({
    where: { companyId, code: input.code },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, 'Ya existe un recorrido con ese codigo en la empresa');

  return prisma.route.create({
    data: {
      companyId,
      name: input.name,
      code: input.code,
      originName: input.originName,
      destinationName: input.destinationName,
      active: input.active ?? true,
    },
    include: routeInclude,
  });
};

export const updateRoute = async (companyId: string, id: string, input: UpdateRouteInput) => {
  await assertOwnedRoute(companyId, id);

  if (input.code !== undefined) {
    const clash = await prisma.route.findFirst({
      where: { companyId, code: input.code, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new HttpError(409, 'Ya existe un recorrido con ese codigo en la empresa');
  }

  return prisma.route.update({ where: { id }, data: input, include: routeInclude });
};

export const deleteRoute = async (companyId: string, id: string): Promise<void> => {
  await assertOwnedRoute(companyId, id);
  await prisma.route.delete({ where: { id } });
};

/**
 * Reemplaza la lista completa de paraderos. El stopOrder sale de la posicion en
 * el array, asi que reordenar es mandar el arreglo en otro orden.
 * Va en transaccion porque un borrado sin su recreacion dejaria el recorrido mudo.
 */
export const replaceStops = async (companyId: string, routeId: string, stops: StopInput[]) => {
  await assertOwnedRoute(companyId, routeId);

  return prisma.$transaction(async (tx) => {
    await tx.routeStop.deleteMany({ where: { routeId } });
    await tx.routeStop.createMany({
      data: stops.map((stop, index) => ({
        routeId,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        stopOrder: index,
      })),
    });
    return tx.routeStop.findMany({ where: { routeId }, orderBy: { stopOrder: 'asc' } });
  });
};

/** Mismo criterio que los paraderos: la lista enviada pasa a ser la unica verdad. */
export const upsertSchedules = async (
  companyId: string,
  routeId: string,
  schedules: ScheduleInput[],
) => {
  await assertOwnedRoute(companyId, routeId);

  return prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({ where: { routeId } });
    await tx.schedule.createMany({
      data: schedules.map((schedule) => ({ routeId, ...schedule })),
    });
    return tx.schedule.findMany({ where: { routeId }, orderBy: { dayType: 'asc' } });
  });
};
