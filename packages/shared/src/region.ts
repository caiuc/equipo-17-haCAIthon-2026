import { z } from 'zod';

/**
 * Zona/ciudad dentro de una region. Vive en el recorrido, no en la empresa:
 * una empresa puede operar en mas de una zona.
 */
export const zoneSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Zone = z.infer<typeof zoneSchema>;

export const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  zones: zoneSchema.array(),
});
export type Region = z.infer<typeof regionSchema>;

/** Arbol completo region -> zonas, para poblar los selectores encadenados. */
export const regionTreeSchema = regionSchema.array();

/**
 * Alta de zona nueva dentro de una region existente. El servicio hace upsert
 * case-insensitive: nunca duplica una zona que ya existe con otra capitalizacion.
 */
export const createZoneSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type CreateZoneInput = z.infer<typeof createZoneSchema>;

export const regionIdParamSchema = z.object({ regionId: z.string().min(1) });
