import { OCCUPANCY_FULL_THRESHOLD, OCCUPANCY_WINDOW_MS, type Occupancy } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';

export type ReportSource = 'DRIVER' | 'PASSENGER';

/** Lo minimo que necesita la resolucion: no se traen filas completas. */
type ReportRow = {
  tripId: string;
  source: ReportSource;
  full: boolean;
  updatedAt: Date;
};

const unknownOccupancy = (): Occupancy => ({
  status: 'UNKNOWN',
  source: null,
  reportCount: 0,
  updatedAt: null,
});

const windowStart = (now = Date.now()): Date => new Date(now - OCCUPANCY_WINDOW_MS);

/**
 * Veredicto sobre los reportes vigentes de UN turno.
 *
 * El chofer manda: sabe mejor que nadie cuanta gente lleva, asi que su reporte
 * corta la votacion de los pasajeros. Recien si no reporto se cuentan los votos
 * netos (a favor menos en contra) para que un "ya no va llena" pueda revertir
 * un FULL viejo.
 */
const resolveFromReports = (reports: ReportRow[]): Occupancy => {
  if (reports.length === 0) return unknownOccupancy();

  const newest = reports.reduce((acc, report) => (report.updatedAt > acc.updatedAt ? report : acc));
  const updatedAt = newest.updatedAt.toISOString();
  const reportCount = reports.length;

  const driverReport = reports
    .filter((report) => report.source === 'DRIVER')
    .reduce<ReportRow | null>(
      (acc, report) => (acc === null || report.updatedAt > acc.updatedAt ? report : acc),
      null,
    );

  if (driverReport) {
    return {
      status: driverReport.full ? 'FULL' : 'NOT_FULL',
      source: 'DRIVER',
      reportCount,
      updatedAt,
    };
  }

  const net = reports.reduce((sum, report) => sum + (report.full ? 1 : -1), 0);

  return {
    status: net >= OCCUPANCY_FULL_THRESHOLD ? 'FULL' : 'NOT_FULL',
    source: 'PASSENGERS',
    reportCount,
    updatedAt,
  };
};

export const resolveOccupancy = async (tripId: string): Promise<Occupancy> => {
  const reports = await prisma.occupancyReport.findMany({
    where: { tripId, updatedAt: { gte: windowStart() } },
    select: { tripId: true, source: true, full: true, updatedAt: true },
  });

  return resolveFromReports(reports);
};

/**
 * Version en lote. El pasajero consulta un recorrido completo cada pocos
 * segundos: resolver micro por micro seria un N+1 en el camino mas transitado,
 * por eso aqui va UNA sola query para todos los turnos.
 */
export const resolveOccupancyMany = async (tripIds: string[]): Promise<Map<string, Occupancy>> => {
  const result = new Map<string, Occupancy>();
  for (const tripId of tripIds) result.set(tripId, unknownOccupancy());
  if (tripIds.length === 0) return result;

  const reports = await prisma.occupancyReport.findMany({
    where: { tripId: { in: tripIds }, updatedAt: { gte: windowStart() } },
    select: { tripId: true, source: true, full: true, updatedAt: true },
  });

  const byTrip = new Map<string, ReportRow[]>();
  for (const report of reports) {
    const bucket = byTrip.get(report.tripId);
    if (bucket) bucket.push(report);
    else byTrip.set(report.tripId, [report]);
  }

  for (const [tripId, tripReports] of byTrip) {
    result.set(tripId, resolveFromReports(tripReports));
  }

  return result;
};

/**
 * Un voto por reportante, actualizable: la persona puede corregirse a "ya no va
 * llena" sin que su voto viejo quede contando.
 */
export const saveOccupancyReport = async (input: {
  tripId: string;
  reporterKey: string;
  source: ReportSource;
  full: boolean;
}): Promise<Occupancy> => {
  const { tripId, reporterKey, source, full } = input;

  await prisma.occupancyReport.upsert({
    where: { tripId_reporterKey: { tripId, reporterKey } },
    create: { tripId, reporterKey, source, full },
    update: { full, source },
  });

  return resolveOccupancy(tripId);
};
