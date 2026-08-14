import { z } from 'zod';
import type { createCompanySchema, updateCompanySchema } from '@equipo17/shared';
import { prisma } from '../lib/prisma.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';
import { HttpError } from '../middlewares/error.js';

type CreateCompanyInput = z.infer<typeof createCompanySchema>;
type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export type CompanySummary = {
  id: string;
  slug: string;
  name: string;
  rut: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  routeCount: number;
  userCount: number;
};

const COUNTS = { _count: { select: { routes: true, users: true } } } as const;

type CompanyWithCounts = {
  id: string;
  slug: string;
  name: string;
  rut: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  _count: { routes: number; users: number };
};

/**
 * Slug a partir del nombre: minusculas, sin tildes, sin simbolos.
 * Es la clave natural de la empresa entre corridas del seed y lo que enlaza a la
 * empresa con su sprite del mapa, asi que tiene que existir siempre. Se le
 * agrega un sufijo si ya esta tomado, porque dos empresas pueden llamarse igual.
 */
const slugify = (nombre: string): string =>
  nombre
    .normalize('NFD')
    // Los diacriticos van escapados y no literales: son caracteres invisibles
    // que cualquier editor o merge puede comerse sin dejar rastro.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa';

const slugDisponible = async (base: string): Promise<string> => {
  for (let intento = 0; intento < 50; intento += 1) {
    const candidato = intento === 0 ? base : `${base}-${intento + 1}`;
    const tomado = await prisma.company.findUnique({
      where: { slug: candidato },
      select: { id: true },
    });
    if (!tomado) return candidato;
  }
  throw new HttpError(409, 'No se pudo generar un identificador para la empresa');
};

const toSummary = (company: CompanyWithCounts): CompanySummary => ({
  id: company.id,
  slug: company.slug,
  name: company.name,
  rut: company.rut,
  status: company.status,
  createdAt: company.createdAt.toISOString(),
  routeCount: company._count.routes,
  userCount: company._count.users,
});

export const listCompanies = async (): Promise<CompanySummary[]> => {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: COUNTS,
  });
  return companies.map(toSummary);
};

/**
 * La empresa nace ACTIVE junto a su COMPANY_ADMIN: sin ese usuario la empresa
 * quedaria creada pero sin nadie que pueda entrar a administrarla.
 * La clave temporal se devuelve una sola vez, aqui; despues solo vive hasheada.
 */
export const createCompany = async (
  input: CreateCompanyInput,
): Promise<CompanySummary & { temporaryPassword: string; adminEmail: string }> => {
  const existing = await prisma.user.findUnique({
    where: { email: input.adminEmail },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'El email del administrador ya esta registrado');

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const slug = await slugDisponible(slugify(input.name));

  const company = await prisma.company.create({
    data: {
      slug,
      name: input.name,
      rut: input.rut,
      status: 'ACTIVE',
      users: {
        create: {
          email: input.adminEmail,
          name: input.adminName,
          passwordHash,
          role: 'COMPANY_ADMIN',
          mustChangePassword: true,
        },
      },
    },
    include: COUNTS,
  });

  return { ...toSummary(company), adminEmail: input.adminEmail, temporaryPassword };
};

export const updateCompany = async (
  id: string,
  input: UpdateCompanyInput,
): Promise<CompanySummary> => {
  const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Empresa no encontrada');

  const company = await prisma.company.update({
    where: { id },
    data: { name: input.name, status: input.status },
    include: COUNTS,
  });
  return toSummary(company);
};

export type PlatformMetrics = {
  companies: number;
  routes: number;
  drivers: number;
  activeTrips: number;
  tripsToday: number;
};

export const metrics = async (): Promise<PlatformMetrics> => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [companies, routes, drivers, activeTrips, tripsToday] = await Promise.all([
    prisma.company.count(),
    prisma.route.count(),
    prisma.user.count({ where: { role: 'DRIVER' } }),
    prisma.trip.count({ where: { status: 'IN_TRANSIT' } }),
    prisma.trip.count({ where: { startedAt: { gte: startOfToday } } }),
  ]);

  return { companies, routes, drivers, activeTrips, tripsToday };
};
