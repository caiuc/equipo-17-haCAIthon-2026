import { Router } from 'express';
import { createItemSchema, updateItemSchema } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../middleware/error.js';

/**
 * CRUD de ejemplo. Sirve como plantilla: copia este archivo, cambia el modelo
 * de Prisma y los schemas de @equipo17/shared, y ya tienes un recurso tipado
 * de punta a punta.
 *
 * Express 5 propaga los errores de handlers async al errorHandler
 * automaticamente, por eso no hace falta try/catch ni next(err).
 */
export const itemsRouter = Router();

itemsRouter.get('/items', async (_req, res) => {
  const items = await prisma.item.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(items);
});

itemsRouter.get('/items/:id', async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!item) throw new HttpError(404, 'Item no encontrado');
  res.json(item);
});

itemsRouter.post('/items', async (req, res) => {
  const data = createItemSchema.parse(req.body);
  const item = await prisma.item.create({ data });
  res.status(201).json(item);
});

itemsRouter.patch('/items/:id', async (req, res) => {
  const data = updateItemSchema.parse(req.body);
  const item = await prisma.item.update({ where: { id: req.params.id }, data });
  res.json(item);
});

itemsRouter.delete('/items/:id', async (req, res) => {
  await prisma.item.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
