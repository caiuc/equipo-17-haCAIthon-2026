import type { CreateZoneInput, Region } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middlewares/error.js';

/** Arbol completo, para poblar los selectores encadenados region -> zona. */
export const listRegions = async (): Promise<Region[]> => {
  const regions = await prisma.region.findMany({
    include: { zones: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  return regions.map((region) => ({
    id: region.id,
    name: region.name,
    zones: region.zones.map((zone) => ({ id: zone.id, name: zone.name })),
  }));
};

/**
 * Upsert case-insensitive: "Talagante" y "talagante" son la misma zona. Nunca
 * duplica, así que cualquier empresa puede crear una zona nueva sin arriesgar
 * que dos recorridos terminen en zonas gemelas que no calzan al filtrar.
 */
export const findOrCreateZone = async (regionId: string, input: CreateZoneInput) => {
  const region = await prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
  if (!region) throw new HttpError(404, 'Region no encontrada');

  const name = input.name.trim();

  const existing = await prisma.zone.findFirst({
    where: { regionId, name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return { id: existing.id, name: existing.name };

  const created = await prisma.zone.create({ data: { regionId, name } });
  return { id: created.id, name: created.name };
};
