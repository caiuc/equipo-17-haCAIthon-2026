import { z } from 'zod';

export const PASSENGER_TYPES = ['ADULT', 'STUDENT', 'SENIOR'] as const;
export const passengerTypeSchema = z.enum(PASSENGER_TYPES);
export type PassengerType = z.infer<typeof passengerTypeSchema>;

export const fareSchema = z.object({
  passengerType: passengerTypeSchema,
  /** Pesos chilenos, entero: el pasaje no tiene decimales. 0 es gratis de verdad. */
  amountClp: z.number().int().nonnegative(),
});
export type Fare = z.infer<typeof fareSchema>;

/**
 * null significa "tarifa no publicada", que NO es lo mismo que 0.
 *
 * Cuatro de las ocho empresas sembradas no publican tarifa, y MuniBus Paine es
 * gratuito de verdad. Colapsar los dos casos con un `?? 0` haria que la interfaz
 * dijera "Gratis" donde en realidad no sabemos, que es la misma clase de mentira
 * que mostrar una posicion vieja como fresca.
 */
export const fareFor = (fares: Fare[], type: PassengerType): number | null =>
  fares.find((fare) => fare.passengerType === type)?.amountClp ?? null;

export const upsertFaresSchema = z.object({
  fares: fareSchema.array().max(PASSENGER_TYPES.length),
});
export type UpsertFaresInput = z.infer<typeof upsertFaresSchema>;
