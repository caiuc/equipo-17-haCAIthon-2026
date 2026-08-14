import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let db: 'ok' | 'down' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }

  res.status(db === 'ok' ? 200 : 503).json({
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
    uptime: process.uptime(),
  });
});
