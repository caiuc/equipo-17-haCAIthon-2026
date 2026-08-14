import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { HttpError } from '../middlewares/error.js';

/** Campos que si pueden salir del servidor: nunca incluye passwordHash. */
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyId: true,
  mustChangePassword: true,
} as const;

const toAuthResponse = (user: PublicUser): AuthResponse => ({
  token: signToken({ sub: user.id, role: user.role, companyId: user.companyId }),
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    mustChangePassword: user.mustChangePassword,
  },
});

/** Auto-registro: siempre PASSENGER. Choferes y admins los crea la empresa. */
export const registerPassenger = async (input: RegisterInput): Promise<AuthResponse> => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'El email ya esta registrado');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      role: 'PASSENGER',
    },
    select: PUBLIC_FIELDS,
  });

  return toAuthResponse(user);
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...PUBLIC_FIELDS, passwordHash: true, company: { select: { status: true } } },
  });

  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
  // Un unico mensaje para "no existe" y "clave mala": distinguirlos deja
  // enumerar que emails tienen cuenta.
  if (!user || !valid) throw new HttpError(401, 'Credenciales invalidas');

  if (user.company?.status === 'SUSPENDED') {
    throw new HttpError(403, 'La empresa esta suspendida');
  }

  return toAuthResponse(user);
};

/** El token puede sobrevivir al usuario, por eso la ausencia es 401 y no 404. */
export const currentUser = async (userId: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_FIELDS });
  if (!user) throw new HttpError(401, 'No autenticado');
  return user;
};
