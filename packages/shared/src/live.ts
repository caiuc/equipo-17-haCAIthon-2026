import { z } from 'zod';
import { freshnessSchema, latLngSchema } from './common.js';
import { companyBriefSchema } from './company.js';

// --- Ingesta del chofer ---

/**
 * Payload que envia el dispositivo del chofer. Conserva latitude/longitude
 * porque es lo que entrega la Geolocation API del navegador tal cual.
 */
export const positionInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).max(300).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  /** Epoch en milisegundos. Si falta, el servidor usa su propio reloj. */
  timestamp: z.number().int().positive().optional(),
});

/**
 * Acepta una posicion o un lote: si el chofer estuvo sin senal, su cliente
 * puede vaciar de golpe lo que acumulo.
 */
export const postPositionsSchema = z.union([
  positionInputSchema,
  z.object({ positions: positionInputSchema.array().min(1).max(200) }),
]);

// --- Ocupacion ---

export const OCCUPANCY_STATUSES = ['FULL', 'NOT_FULL', 'UNKNOWN'] as const;
export const occupancyStatusSchema = z.enum(OCCUPANCY_STATUSES);
export type OccupancyStatus = z.infer<typeof occupancyStatusSchema>;

export const occupancySchema = z.object({
  status: occupancyStatusSchema,
  /** De donde sale el veredicto: el chofer manda sobre los pasajeros. */
  source: z.enum(['DRIVER', 'PASSENGERS']).nullable(),
  reportCount: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
});
export type Occupancy = z.infer<typeof occupancySchema>;

export const reportOccupancySchema = z.object({
  full: z.boolean(),
});

// --- Lectura del pasajero ---

/**
 * Una micro en ruta. Todo dato posicional viene acompanado de su edad y su
 * estado de frescura: nunca se muestra una posicion sin decir que tan vieja es.
 */
export const liveBusSchema = z.object({
  tripId: z.string(),
  routeId: z.string(),
  /** El mapa mezcla recorridos de varias empresas: cada micro declara el suyo. */
  routeCode: z.string(),
  routeName: z.string(),
  company: companyBriefSchema,
  /** null cuando el chofer inicio turno sin declarar vehiculo. No se inventa. */
  plate: z.string().nullable(),
  seats: z.number().int().positive().nullable(),
  /**
   * Tarifa de adulto: el numero que el pasajero necesita tener en la mano.
   * null = no publicada. NO se colapsa con 0, que significa gratuito.
   */
  fareAdultClp: z.number().int().nonnegative().nullable(),
  driverName: z.string(),
  position: latLngSchema,
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  recordedAt: z.string(),
  ageSeconds: z.number().nonnegative(),
  freshness: freshnessSchema,
  /**
   * Distancia en linea recta al paradero consultado.
   * Es null cuando la frescura es NO_SIGNAL: calcular distancia sobre una
   * posicion vieja seria justamente la confianza falsa que hay que evitar.
   */
  distanceMeters: z.number().nullable(),
  occupancy: occupancySchema,
});
export type LiveBus = z.infer<typeof liveBusSchema>;

export const liveRouteSchema = z.object({
  routeId: z.string(),
  routeName: z.string(),
  /** Reloj del servidor: el cliente calcula edades con este, no con el suyo. */
  serverTime: z.string(),
  stopId: z.string().nullable(),
  buses: liveBusSchema.array(),
  /** true cuando no hay ninguna micro transmitiendo: "no hay micros en ruta". */
  outOfService: z.boolean(),
});
export type LiveRoute = z.infer<typeof liveRouteSchema>;

export const liveQuerySchema = z.object({
  stopId: z.string().min(1).optional(),
});

// --- El mapa: todas las micros vivas, de todas las empresas ---

/**
 * Caja del viewport en orden OGC/GeoJSON: oeste,sur,este,norte.
 *
 * Se valida en vez de corregir en silencio porque un bbox invertido devolveria
 * un mapa vacio sin ningun error visible, que es la peor clase de bug: parece
 * "no hay micros" cuando en realidad la consulta estaba mal.
 *
 * No se contempla cruce del antimeridiano: Chile no lo cruza, y manejarlo seria
 * complejidad sin caso de uso.
 */
export const bboxSchema = z
  .string()
  .transform((raw) => raw.split(',').map(Number))
  .refine(
    (parts) => parts.length === 4 && parts.every((n) => Number.isFinite(n)),
    'bbox debe ser cuatro numeros: minLng,minLat,maxLng,maxLat',
  )
  .transform(([west, south, east, north]) => ({
    west: west as number,
    south: south as number,
    east: east as number,
    north: north as number,
  }))
  .refine((b) => b.west < b.east && b.south < b.north, 'bbox invertido')
  .refine(
    (b) => b.south >= -90 && b.north <= 90 && b.west >= -180 && b.east <= 180,
    'bbox fuera de rango geografico',
  );
export type Bounds = z.infer<typeof bboxSchema>;

export const liveBusesQuerySchema = z.object({
  /**
   * Opcional: el primer render ocurre antes de que el mapa reporte sus limites,
   * y la lista del bottom sheet los necesita todos.
   */
  bbox: bboxSchema.optional(),
  companyId: z.string().min(1).optional(),
  routeId: z.string().min(1).optional(),
  /** Paradero de referencia para la distancia. */
  stopId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type LiveBusesQuery = z.infer<typeof liveBusesQuerySchema>;

export const liveBusesSchema = z.object({
  /** Reloj del servidor: el cliente calcula edades con este, no con el suyo. */
  serverTime: z.string(),
  stopId: z.string().nullable(),
  buses: liveBusSchema.array(),
  /** Cuantas micros vivas habia antes de recortar por limit. */
  total: z.number().int().nonnegative(),
  /** true si se recorto: la interfaz debe decir que hay mas fuera de la vista. */
  truncated: z.boolean(),
});
export type LiveBuses = z.infer<typeof liveBusesSchema>;

export type PositionInput = z.infer<typeof positionInputSchema>;
