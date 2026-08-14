import { z } from 'zod';
import { freshnessSchema, latLngSchema } from './common.js';

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

export type PositionInput = z.infer<typeof positionInputSchema>;
