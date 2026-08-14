import { z } from 'zod';
import { roleSchema } from './common.js';

/** Solo pasajeros se auto-registran. Choferes y admins los crea la empresa. */
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Minimo 8 caracteres').max(128),
  name: z.string().trim().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  companyId: z.string().nullable(),
  mustChangePassword: z.boolean(),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: publicUserSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
