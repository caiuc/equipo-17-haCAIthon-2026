import 'dotenv/config';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-secret-no-usar-en-produccion';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Opcional a proposito: los tests mockean Prisma y no necesitan base de datos.
  DATABASE_URL: z.string().optional(),
  // Lista separada por comas. En dev el proxy de Vite hace que CORS no sea necesario.
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default('12h'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// En produccion no se arranca con el secreto de desarrollo: seria dejar la
// puerta abierta a que cualquiera firme sus propios tokens.
if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEV_JWT_SECRET) {
  console.error('JWT_SECRET es obligatorio en produccion.');
  process.exit(1);
}

export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
