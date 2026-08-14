import { z } from 'zod';
import { dayTypeSchema } from './common.js';
import { companyBriefSchema } from './company.js';
import { fareSchema } from './fare.js';
import { zoneSchema } from './region.js';

export const routeStopSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  stopOrder: z.number().int().nonnegative(),
});

export const scheduleSchema = z.object({
  dayType: dayTypeSchema,
  firstDeparture: z.string(),
  lastDeparture: z.string(),
});

export const routeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  originName: z.string(),
  destinationName: z.string(),
  /**
   * Reemplaza al antiguo `companyName`: el mapa necesita ademas el color con el
   * que pintar la micro y el sprite que le corresponde a esta empresa.
   */
  company: companyBriefSchema,
  /**
   * null = zona pendiente de asignar por la empresa, nunca se infiere.
   * Va aparte de `company` a proposito: una empresa puede operar en mas de
   * una zona, asi que la zona describe el recorrido, no a quien lo presta.
   */
  zone: zoneSchema.nullable(),
  /**
   * De 0 a 3 filas. Vacio significa "la empresa no publica tarifa para este
   * recorrido", que no es lo mismo que gratis. Ver fareFor() en fare.ts.
   */
  fares: fareSchema.array(),
  /** Cuantas micros van en ruta ahora mismo. 0 responde el "no viene ninguna". */
  activeBuses: z.number().int().nonnegative(),
});

export const routeDetailSchema = routeSummarySchema.extend({
  stops: routeStopSchema.array(),
  schedules: scheduleSchema.array(),
  /**
   * Trazado real del recorrido por las calles, en el "encoded polyline" de
   * Google. Va solo en el detalle y no en el resumen: son ~1-6 KB por recorrido
   * y la lista de busqueda no dibuja ningun camino.
   *
   * Para dibujarlo en el mapa, la polilinea codificada se le pasa directo a la
   * API de Google, que ya sabe leer este formato:
   *
   *   new google.maps.Polyline({
   *     path: google.maps.geometry.encoding.decodePath(route.pathPolyline),
   *     map,
   *   })
   *
   * (`decodePath` vive en la libreria `geometry`, hay que pedirla al cargar el
   * script de Maps.)
   *
   * **null significa que este recorrido no tiene trazado calculado**, no que no
   * tenga camino: el dibujo debe caer entonces a unir `stops` en linea recta.
   * Nunca asumir que viene: el trazado lo calcula un script aparte
   * (`apps/api/tools/trazados`) contra una API que cobra por llamada, y hay
   * recorridos que quedan sin el a proposito.
   */
  pathPolyline: z.string().nullable(),
});

// --- Entradas de la empresa ---

export const createRouteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(40),
  originName: z.string().trim().min(2).max(120),
  destinationName: z.string().trim().min(2).max(120),
  active: z.boolean().optional().default(true),
  /** Opcional: null/ausente desasigna la zona ("pendiente"), nunca se inventa. */
  zoneId: z.string().nullable().optional(),
});

export const updateRouteSchema = createRouteSchema.partial();

/**
 * Los paraderos se reemplazan como lista completa y ordenada: el orden lo define
 * la posicion en el array. Evita el infierno de reordenar de a uno.
 */
export const replaceStopsSchema = z.object({
  stops: z
    .object({
      name: z.string().trim().min(1).max(120),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .array()
    .min(2, 'Un recorrido necesita al menos origen y destino')
    .max(200),
});

export const upsertScheduleSchema = z.object({
  schedules: z
    .object({
      dayType: dayTypeSchema,
      firstDeparture: z.string().regex(/^\d{1,2}:\d{2}$/, 'Formato HH:mm'),
      lastDeparture: z.string().regex(/^\d{1,2}:\d{2}$/, 'Formato HH:mm'),
    })
    .array()
    .max(3),
});

/**
 * `companyId` repetido en la query string (`?companyId=a&companyId=b`) llega
 * como array; una sola aparicion llega como string suelto. Se normaliza a
 * array siempre para que el servicio no tenga que distinguir los dos casos.
 */
export const searchRoutesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  companyId: z
    .union([z.string(), z.string().array()])
    .optional()
    .transform((value) => (value === undefined ? undefined : ([] as string[]).concat(value))),
  zoneId: z.string().optional(),
});

export type RouteStop = z.infer<typeof routeStopSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type RouteDetail = z.infer<typeof routeDetailSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type ReplaceStopsInput = z.infer<typeof replaceStopsSchema>;
