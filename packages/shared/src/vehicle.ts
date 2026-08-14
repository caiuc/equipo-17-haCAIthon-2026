import { z } from 'zod';

/**
 * Sprites de micro disponibles en frontend/public/assets/micros/<slug>.png.
 *
 * Es una lista blanca y NO un z.string() a proposito: el cliente usa este valor
 * para construir la ruta de un archivo. Un string libre que venga de la base
 * seria una ruta arbitraria armada con datos de la base.
 *
 * Cada empresa sembrada tiene su propio sprite porque el color va horneado en la
 * textura del modelo 3D del que se pre-renderiza. `generico` es el que reciben
 * las empresas creadas desde el panel de admin, que no tienen dibujo propio.
 */
export const ASSET_SLUGS = [
  'generico',
  'bupesa',
  'talagante',
  'islaval',
  'damir',
  'cobrexpress',
  'paine',
  'munibus',
  'colina',
] as const;

export const assetSlugSchema = z.enum(ASSET_SLUGS);
export type AssetSlug = z.infer<typeof assetSlugSchema>;

export const DEFAULT_ASSET_SLUG: AssetSlug = 'generico';

/**
 * Tolerante en la lectura: si la base trae un slug que este build no conoce
 * (empresa nueva, sprite aun no generado), se cae al generico en vez de romper
 * el mapa entero. La escritura si valida estricto con assetSlugSchema.
 */
export const assetSlugOr = (value: string | null | undefined): AssetSlug =>
  assetSlugSchema.safeParse(value).success ? (value as AssetSlug) : DEFAULT_ASSET_SLUG;

/** Ruta del sprite, unica funcion que sabe donde viven los dibujos. */
export const assetPath = (slug: AssetSlug): string => `/assets/micros/${slug}.png`;
