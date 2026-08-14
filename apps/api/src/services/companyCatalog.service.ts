import { assetSlugOr, type CompanyBrief } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';

/**
 * Catalogo de empresas y recorridos activos, cacheado en memoria.
 *
 * Por que una cache y no denormalizar esto dentro de LiveTrip: el store se
 * escribe en cada ping del chofer, o sea cada DRIVER_PING_INTERVAL_MS por micro.
 * Meter ahi el color, el sprite y la tarifa encareceria el camino de ESCRITURA
 * -- el mas caliente del sistema -- para arrastrar datos que cambian una vez al
 * mes. Y peor: quedarian congelados en el instante en que arranco el turno, asi
 * que una empresa que corrige su tarifa a media manana no veria el cambio hasta
 * que la micro termine el recorrido.
 *
 * Con TTL de un minuto el costo es una consulta por minuto, no una por request
 * ni una por ping.
 */
export type RouteCatalogEntry = {
  routeId: string;
  routeCode: string;
  routeName: string;
  company: CompanyBrief;
  /**
   * Tarifa de adulto en pesos.
   *
   * `null` significa "no publicada" y `0` significa gratuito de verdad: son dos
   * hechos distintos y la interfaz los muestra distinto. Un `?? 0` en cualquier
   * punto de esta cadena haria que el mapa dijera "Gratis" donde no sabemos.
   */
  fareAdultClp: number | null;
};

const CATALOG_TTL_MS = 60_000;

type Catalog = Map<string, RouteCatalogEntry>;

let cached: Catalog | null = null;
let cachedAt = 0;
/** Vuelo en curso: si llegan diez requests juntos, se hace una sola consulta. */
let inFlight: Promise<Catalog> | null = null;

const load = async (): Promise<Catalog> => {
  // Solo empresas ACTIVE: una empresa suspendida no debe aparecer en el mapa
  // aunque sus micros sigan vivas en el store en memoria.
  const companies = await prisma.company.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      slug: true,
      name: true,
      color: true,
      assetSlug: true,
      routes: {
        where: { active: true },
        select: {
          id: true,
          code: true,
          name: true,
          fares: {
            where: { passengerType: 'ADULT' },
            select: { amountClp: true },
          },
        },
      },
    },
  });

  const catalog: Catalog = new Map();

  for (const company of companies) {
    const brief: CompanyBrief = {
      id: company.id,
      slug: company.slug,
      name: company.name,
      color: company.color,
      // Tolerante: una empresa creada desde el panel puede traer un slug que
      // este build no conoce. Cae al generico en vez de romper el mapa entero.
      assetSlug: assetSlugOr(company.assetSlug),
    };

    for (const route of company.routes) {
      catalog.set(route.id, {
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        company: brief,
        fareAdultClp: route.fares[0]?.amountClp ?? null,
      });
    }
  }

  return catalog;
};

export const getCatalog = async (now = Date.now()): Promise<Catalog> => {
  if (cached && now - cachedAt < CATALOG_TTL_MS) return cached;
  if (inFlight) return inFlight;

  inFlight = load()
    .then((catalog) => {
      cached = catalog;
      cachedAt = now;
      return catalog;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Los tests comparten proceso, asi que sin esto el segundo test veria las
 * empresas del primero. Mismo motivo por el que liveStore exporta clearLiveTrips.
 */
export const clearCatalogCache = (): void => {
  cached = null;
  cachedAt = 0;
  inFlight = null;
};
