import { z } from 'zod';
import { tripStatusSchema } from './common.js';

export const startTripSchema = z.object({
  routeId: z.string().min(1),
  /**
   * Opcional a proposito: la empresa puede no haber cargado su flota todavia, y
   * un turno que no se puede iniciar por eso seria peor que un turno sin patente.
   * Cuando falta, el mapa cae al sprite de la empresa y no inventa un vehiculo.
   */
  busId: z.string().min(1).optional(),
});

export const busSchema = z.object({
  id: z.string(),
  plate: z.string(),
  seats: z.number().int().positive().nullable(),
  active: z.boolean(),
});
export type Bus = z.infer<typeof busSchema>;

export const tripSchema = z.object({
  id: z.string(),
  routeId: z.string(),
  routeName: z.string(),
  driverId: z.string(),
  status: tripStatusSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type Trip = z.infer<typeof tripSchema>;

// --- Gestion de choferes (la empresa crea la cuenta) ---

export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  licenseNumber: z.string().trim().max(40).optional(),
});

export const updateDriverSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  licenseNumber: z.string().trim().max(40).optional(),
  driverStatus: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
});

export const driverSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  licenseNumber: z.string().nullable(),
  driverStatus: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).nullable(),
  createdAt: z.string(),
});
export type Driver = z.infer<typeof driverSchema>;

/** La clave temporal se devuelve UNA sola vez, al crear el chofer. */
export const createdDriverSchema = driverSchema.extend({
  temporaryPassword: z.string(),
});
export type CreatedDriver = z.infer<typeof createdDriverSchema>;

// --- Empresas (superadmin) ---

export const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(160),
  rut: z.string().trim().max(20).optional(),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminName: z.string().trim().min(2).max(120),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});
