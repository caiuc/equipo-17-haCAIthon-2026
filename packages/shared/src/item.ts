import { z } from 'zod';

/**
 * Contrato compartido entre API y web.
 * Reemplaza `Item` por la entidad real del proyecto: los tipos se propagan
 * automaticamente a los dos lados (validacion en el backend, tipado en el front).
 */
export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  createdAt: z.coerce.date(),
});

export const createItemSchema = z.object({
  title: z.string().trim().min(1, 'El titulo no puede estar vacio').max(200),
  done: z.boolean().optional().default(false),
});

export const updateItemSchema = createItemSchema.partial();

export type Item = z.infer<typeof itemSchema>;
export type CreateItemInput = z.input<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/** Forma de error que devuelve el API en cualquier fallo. */
export type ApiError = {
  error: {
    message: string;
    details?: unknown;
  };
};
