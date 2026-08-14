import { z } from 'zod';
import { assetSlugSchema } from './vehicle.js';

/**
 * Privada o municipal. No decide la tarifa: gratis es una fila de Fare con
 * amountClp 0, no una consecuencia de ser municipal. Sirve para explicar por que
 * una empresa no tiene rut y para distinguir el servicio en la interfaz.
 */
export const COMPANY_KINDS = ['PRIVATE', 'MUNICIPAL'] as const;
export const companyKindSchema = z.enum(COMPANY_KINDS);
export type CompanyKind = z.infer<typeof companyKindSchema>;

/** Hex de 6 digitos: se usa tal cual como color en el mapa y en la lista. */
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex #rrggbb');

/**
 * Lo minimo para identificar y pintar una empresa. Va embebido en cada recorrido
 * y en cada micro del mapa: repetir cuatro campos cortos sale mas barato que
 * obligar al cliente a mantener sincronizado un diccionario de empresas.
 */
export const companyBriefSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  color: hexColorSchema,
  assetSlug: assetSlugSchema,
});
export type CompanyBrief = z.infer<typeof companyBriefSchema>;

/**
 * Ficha publica completa. El telefono no es un adorno: es la salida cuando no
 * hay ninguna micro transmitiendo, y "llamalos" es mejor respuesta que una
 * pantalla vacia.
 */
export const publicCompanySchema = companyBriefSchema.extend({
  kind: companyKindSchema,
  phone: z.string().nullable(),
  website: z.string().nullable(),
  /**
   * De donde salio la ficha y cuando se consulto. El principio rector del
   * proyecto vale tambien para el dato estatico: una tarifa de hace cuatro anos
   * mostrada sin fecha es tan enganosa como una posicion vieja mostrada como
   * fresca.
   */
  sourceUrl: z.string().nullable(),
  sourceCheckedAt: z.string().nullable(),
  /** Cuantos recorridos activos publica. Da contexto sin una segunda consulta. */
  routeCount: z.number().int().nonnegative(),
});
export type PublicCompany = z.infer<typeof publicCompanySchema>;
