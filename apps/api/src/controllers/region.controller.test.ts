import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    region: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    zone: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');
const { signToken } = await import('../lib/jwt.js');

const adminToken = signToken({ sub: 'u1', role: 'COMPANY_ADMIN', companyId: 'c1' });
const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/regions', () => {
  it('devuelve el arbol region -> zonas', async () => {
    prismaMock.region.findMany.mockResolvedValue([
      { id: 'reg1', name: 'Región Metropolitana', zones: [{ id: 'z1', name: 'Talagante' }] },
    ]);

    const res = await request(app).get('/api/regions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'reg1', name: 'Región Metropolitana', zones: [{ id: 'z1', name: 'Talagante' }] },
    ]);
  });
});

describe('POST /api/company/regions/:regionId/zones', () => {
  it('crea la zona cuando no existe', async () => {
    prismaMock.region.findUnique.mockResolvedValue({ id: 'reg1' });
    prismaMock.zone.findFirst.mockResolvedValue(null);
    prismaMock.zone.create.mockResolvedValue({ id: 'z-nueva', name: 'Buin' });

    const res = await asAdmin(
      request(app).post('/api/company/regions/reg1/zones').send({ name: 'Buin' }),
    ).expect(201);

    expect(res.body).toEqual({ id: 'z-nueva', name: 'Buin' });
    expect(prismaMock.zone.create).toHaveBeenCalledWith({
      data: { regionId: 'reg1', name: 'Buin' },
    });
  });

  it('es idempotente: crear "Talagante" y "talagante" devuelve la misma fila', async () => {
    prismaMock.region.findUnique.mockResolvedValue({ id: 'reg1' });
    prismaMock.zone.findFirst.mockResolvedValue({ id: 'z-existente', name: 'Talagante' });

    const res = await asAdmin(
      request(app).post('/api/company/regions/reg1/zones').send({ name: 'talagante' }),
    ).expect(201);

    expect(res.body).toEqual({ id: 'z-existente', name: 'Talagante' });
    expect(prismaMock.zone.create).not.toHaveBeenCalled();
    // Busca insensible a mayusculas dentro de la misma region.
    expect(prismaMock.zone.findFirst).toHaveBeenCalledWith({
      where: { regionId: 'reg1', name: { equals: 'talagante', mode: 'insensitive' } },
    });
  });

  it('devuelve 404 si la region no existe', async () => {
    prismaMock.region.findUnique.mockResolvedValue(null);

    const res = await asAdmin(
      request(app).post('/api/company/regions/reg-fantasma/zones').send({ name: 'Buin' }),
    ).expect(404);

    expect(res.body.error.message).toMatch(/region/i);
    expect(prismaMock.zone.create).not.toHaveBeenCalled();
  });

  it('rechaza nombre vacio con 400', async () => {
    await asAdmin(
      request(app).post('/api/company/regions/reg1/zones').send({ name: '' }),
    ).expect(400);

    expect(prismaMock.region.findUnique).not.toHaveBeenCalled();
  });
});
