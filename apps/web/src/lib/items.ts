import { itemSchema, type CreateItemInput, type Item } from '@equipo17/shared';
import { apiFetch } from './api.js';

// itemSchema hace de parser: convierte createdAt (string JSON) en Date.
const itemListSchema = itemSchema.array();

export const itemsApi = {
  list: async (): Promise<Item[]> => itemListSchema.parse(await apiFetch<unknown>('/api/items')),

  create: async (input: CreateItemInput): Promise<Item> =>
    itemSchema.parse(
      await apiFetch<unknown>('/api/items', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    ),

  toggle: async (id: string, done: boolean): Promise<Item> =>
    itemSchema.parse(
      await apiFetch<unknown>(`/api/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done }),
      }),
    ),

  remove: (id: string): Promise<void> => apiFetch<void>(`/api/items/${id}`, { method: 'DELETE' }),
};
