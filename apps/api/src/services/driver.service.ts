import type { Freshness } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';
import { HttpError } from '../middlewares/error.js';
import { ageSecondsOf, freshnessOf, getLiveTripsByCompany } from './liveStore.js';

export type CreateDriverInput = {
  name: string;
  email: string;
  licenseNumber?: string;
};

export type UpdateDriverInput = {
  name?: string;
  licenseNumber?: string;
  driverStatus?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
};

// Proyeccion explicita: el passwordHash no puede salir nunca de esta capa.
const driverSelect = {
  id: true,
  name: true,
  email: true,
  licenseNumber: true,
  driverStatus: true,
  createdAt: true,
} as const;

export const listDrivers = async (companyId: string) =>
  prisma.user.findMany({
    where: { companyId, role: 'DRIVER' },
    select: driverSelect,
    orderBy: { name: 'asc' },
  });

/**
 * La empresa crea la cuenta del chofer, no el chofer. La clave temporal se
 * devuelve en claro UNA sola vez para que el admin se la dicte; despues solo
 * queda el hash y mustChangePassword obliga a cambiarla al primer ingreso.
 */
export const createDriver = async (companyId: string, input: CreateDriverInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'Ya existe una cuenta con ese correo');

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const driver = await prisma.user.create({
    data: {
      companyId,
      email: input.email,
      name: input.name,
      passwordHash,
      role: 'DRIVER',
      licenseNumber: input.licenseNumber ?? null,
      driverStatus: 'ACTIVE',
      mustChangePassword: true,
    },
    select: driverSelect,
  });

  return { ...driver, temporaryPassword };
};

export const updateDriver = async (companyId: string, id: string, input: UpdateDriverInput) => {
  // El filtro por companyId va en la busqueda previa: un chofer de otra empresa
  // se responde como inexistente.
  const driver = await prisma.user.findFirst({
    where: { id, companyId, role: 'DRIVER' },
    select: { id: true },
  });
  if (!driver) throw new HttpError(404, 'Chofer no encontrado');

  return prisma.user.update({ where: { id }, data: input, select: driverSelect });
};

export type CompanyLiveTrip = {
  tripId: string;
  routeId: string;
  routeName: string;
  driverId: string;
  driverName: string;
  startedAt: Date;
  position: { lat: number; lng: number } | null;
  recordedAt: string | null;
  ageSeconds: number | null;
  freshness: Freshness;
};

/**
 * Monitoreo de flota: turnos en curso de la empresa cruzados con el store en
 * memoria. Un turno recien iniciado todavia no tiene posicion y aun asi se
 * muestra, en NO_SIGNAL: ocultarlo haria creer que la micro no salio.
 */
export const listLiveTrips = async (companyId: string): Promise<CompanyLiveTrip[]> => {
  const trips = await prisma.trip.findMany({
    where: { companyId, status: 'IN_TRANSIT' },
    select: {
      id: true,
      routeId: true,
      driverId: true,
      startedAt: true,
      route: { select: { name: true } },
      driver: { select: { name: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  const live = new Map(getLiveTripsByCompany(companyId).map((trip) => [trip.tripId, trip]));
  const now = Date.now();

  return trips.map((trip) => {
    const last = live.get(trip.id);
    return {
      tripId: trip.id,
      routeId: trip.routeId,
      routeName: trip.route.name,
      driverId: trip.driverId,
      driverName: trip.driver.name,
      startedAt: trip.startedAt,
      position: last ? { lat: last.lat, lng: last.lng } : null,
      recordedAt: last ? last.recordedAt.toISOString() : null,
      ageSeconds: last ? ageSecondsOf(last.recordedAt, now) : null,
      freshness: last ? freshnessOf(last.recordedAt, now) : 'NO_SIGNAL',
    };
  });
};
