import { z } from 'zod';
import { dayTypeSchema } from './common.js';

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
  companyName: z.string(),
  /** Cuantas micros van en ruta ahora mismo. 0 responde el "no viene ninguna". */
  activeBuses: z.number().int().nonnegative(),
});

export const routeDetailSchema = routeSummarySchema.extend({
  stops: routeStopSchema.array(),
  schedules: scheduleSchema.array(),
});

// --- Entradas de la empresa ---

export const createRouteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(40),
  originName: z.string().trim().min(2).max(120),
  destinationName: z.string().trim().min(2).max(120),
  active: z.boolean().optional().default(true),
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

export const searchRoutesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

export type RouteStop = z.infer<typeof routeStopSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type RouteDetail = z.infer<typeof routeDetailSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type ReplaceStopsInput = z.infer<typeof replaceStopsSchema>;
