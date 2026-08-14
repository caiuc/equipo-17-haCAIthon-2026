import { z } from 'zod';

export const ROLES = ['SUPERADMIN', 'COMPANY_ADMIN', 'DRIVER', 'PASSENGER'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const DAY_TYPES = ['WEEKDAY', 'SATURDAY', 'SUNDAY'] as const;
export const dayTypeSchema = z.enum(DAY_TYPES);
export type DayType = z.infer<typeof dayTypeSchema>;

export const TRIP_STATUSES = ['IN_TRANSIT', 'COMPLETED', 'CANCELLED'] as const;
export const tripStatusSchema = z.enum(TRIP_STATUSES);
export type TripStatus = z.infer<typeof tripStatusSchema>;

/**
 * Estados de frescura (§4.5 de los requerimientos). Todo lo que se muestre al
 * pasajero debe estar en exactamente uno de estos.
 */
export const FRESHNESS_STATES = ['LIVE', 'INTERMITTENT', 'NO_SIGNAL', 'OUT_OF_SERVICE'] as const;
export const freshnessSchema = z.enum(FRESHNESS_STATES);
export type Freshness = z.infer<typeof freshnessSchema>;

/** Punto geografico en el formato que consume Google Maps sin conversion. */
export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

/** Forma de error que devuelve el API en cualquier fallo. Nunca lleva stack. */
export type ApiError = {
  error: {
    message: string;
    details?: unknown;
  };
};

export const idParamSchema = z.object({ id: z.string().min(1) });
