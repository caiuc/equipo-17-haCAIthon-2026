import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

type MigrationsState = 'ok' | 'failed' | 'unknown';

/**
 * Un SELECT 1 solo prueba que hay conexion, no que el esquema sea el que el
 * cliente Prisma espera. Si una migracion queda a medias, la base responde
 * perfecto y el API devuelve 500 en cada endpoint que toque la tabla afectada.
 *
 * Prisma deja rastro en _prisma_migrations: una fila con finished_at NULL es una
 * migracion que arranco y nunca termino, y rolled_back_at marca las revertidas.
 * Cualquiera de las dos significa que el esquema no es de fiar.
 */
async function migrationsState(): Promise<MigrationsState> {
  try {
    const [row] = await prisma.$queryRaw<{ rotas: bigint }[]>`
      SELECT COUNT(*) AS rotas
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
    `;
    return Number(row?.rotas ?? 0) === 0 ? 'ok' : 'failed';
  } catch {
    // Sin tabla de migraciones (base recien creada, tests con Prisma mockeado)
    // no hay nada que reportar: no es un fallo, es ausencia de informacion.
    return 'unknown';
  }
}

healthRouter.get('/health', async (_req, res) => {
  let db: 'ok' | 'down' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }

  const migrations = db === 'ok' ? await migrationsState() : 'unknown';

  // 503 tambien con las migraciones rotas: el health check del ALB apunta aqui,
  // asi que un despliegue con el esquema a medias no llega a entrar en servicio.
  const sano = db === 'ok' && migrations !== 'failed';

  res.status(sano ? 200 : 503).json({
    status: sano ? 'ok' : 'degraded',
    db,
    migrations,
    uptime: process.uptime(),
  });
});
