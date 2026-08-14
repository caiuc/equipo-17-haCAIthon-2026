import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Prisma mockeado: estos tests verifican el contrato HTTP y, sobre todo, que
// cada query lleve el companyId del token. No necesitan base de datos.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    route: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    routeStop: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    schedule: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    trip: { findMany: vi.fn() },
    zone: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');
const { signToken } = await import('../lib/jwt.js');
const { clearLiveTrips, upsertLiveTrip } = await import('../services/liveStore.js');

const adminToken = signToken({ sub: 'u1', role: 'COMPANY_ADMIN', companyId: 'c1' });
const driverToken = signToken({ sub: 'u2', role: 'DRIVER', companyId: 'c1' });

const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

beforeEach(() => {
  vi.clearAllMocks();
  clearLiveTrips();
  // La transaccion se ejecuta contra el mismo mock: lo que importa es que el
  // servicio haga borrar + recrear dentro de ella.
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );
});

describe('autenticacion y roles', () => {
  it('sin token responde 401', async () => {
    await request(app).get('/api/company/routes').expect(401);
  });

  it('con rol DRIVER responde 403', async () => {
    await request(app)
      .get('/api/company/routes')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(403);
  });
});

describe('recorridos', () => {
  it('lista solo los recorridos del companyId del token', async () => {
    prismaMock.route.findMany.mockResolvedValue([{ id: 'r1', code: 'P-01' }]);

    const res = await asAdmin(request(app).get('/api/company/routes')).expect(200);

    expect(res.body).toHaveLength(1);
    expect(prismaMock.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } }),
    );
  });

  it('un recorrido de otra empresa da 404, no 403', async () => {
    // findFirst filtra por companyId, asi que el de otra empresa no aparece.
    prismaMock.route.findFirst.mockResolvedValue(null);

    const res = await asAdmin(request(app).get('/api/company/routes/r-de-otra')).expect(404);

    expect(prismaMock.route.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r-de-otra', companyId: 'c1' } }),
    );
    expect(res.body.error.message).toMatch(/no encontrado/i);
  });

  it('crea el recorrido con el companyId del token', async () => {
    prismaMock.route.findFirst.mockResolvedValue(null);
    prismaMock.route.create.mockResolvedValue({ id: 'r1', code: 'P-01' });

    await asAdmin(
      request(app).post('/api/company/routes').send({
        name: 'Penaflor - Santiago',
        code: 'P-01',
        originName: 'Terminal Penaflor',
        destinationName: 'Terminal San Borja',
      }),
    ).expect(201);

    expect(prismaMock.route.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1' }) }),
    );
  });

  it('rechaza con 409 un codigo repetido en la empresa', async () => {
    prismaMock.route.findFirst.mockResolvedValue({ id: 'ya-existe' });

    await asAdmin(
      request(app).post('/api/company/routes').send({
        name: 'Penaflor - Santiago',
        code: 'P-01',
        originName: 'Terminal Penaflor',
        destinationName: 'Terminal San Borja',
      }),
    ).expect(409);

    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });

  it('acepta zoneId cuando la zona existe y la manda a route.create', async () => {
    prismaMock.route.findFirst.mockResolvedValue(null);
    prismaMock.zone.findUnique.mockResolvedValue({ id: 'z1' });
    prismaMock.route.create.mockResolvedValue({ id: 'r1', code: 'P-01' });

    await asAdmin(
      request(app).post('/api/company/routes').send({
        name: 'Penaflor - Santiago',
        code: 'P-01',
        originName: 'Terminal Penaflor',
        destinationName: 'Terminal San Borja',
        zoneId: 'z1',
      }),
    ).expect(201);

    expect(prismaMock.route.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ zoneId: 'z1' }) }),
    );
  });

  it('rechaza con 400 una zoneId que no existe, sin crear el Route', async () => {
    prismaMock.route.findFirst.mockResolvedValue(null);
    prismaMock.zone.findUnique.mockResolvedValue(null);

    const res = await asAdmin(
      request(app).post('/api/company/routes').send({
        name: 'Penaflor - Santiago',
        code: 'P-01',
        originName: 'Terminal Penaflor',
        destinationName: 'Terminal San Borja',
        zoneId: 'z-fantasma',
      }),
    ).expect(400);

    expect(res.body.error.message).toMatch(/zona/i);
    expect(prismaMock.route.create).not.toHaveBeenCalled();
  });
});

describe('paraderos', () => {
  it('replaceStops borra y recrea asignando stopOrder secuencial', async () => {
    prismaMock.route.findFirst.mockResolvedValue({ id: 'r1' });
    prismaMock.routeStop.findMany.mockResolvedValue([]);

    await asAdmin(
      request(app)
        .put('/api/company/routes/r1/stops')
        .send({
          stops: [
            { name: 'Terminal', lat: -33.6, lng: -70.9 },
            { name: 'Plaza', lat: -33.5, lng: -70.8 },
            { name: 'San Borja', lat: -33.45, lng: -70.68 },
          ],
        }),
    ).expect(200);

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.routeStop.deleteMany).toHaveBeenCalledWith({ where: { routeId: 'r1' } });
    expect(prismaMock.routeStop.createMany).toHaveBeenCalledWith({
      data: [
        { routeId: 'r1', name: 'Terminal', lat: -33.6, lng: -70.9, stopOrder: 0 },
        { routeId: 'r1', name: 'Plaza', lat: -33.5, lng: -70.8, stopOrder: 1 },
        { routeId: 'r1', name: 'San Borja', lat: -33.45, lng: -70.68, stopOrder: 2 },
      ],
    });
  });

  it('no toca paraderos de un recorrido de otra empresa', async () => {
    prismaMock.route.findFirst.mockResolvedValue(null);

    await asAdmin(
      request(app)
        .put('/api/company/routes/r-de-otra/stops')
        .send({
          stops: [
            { name: 'A', lat: 0, lng: 0 },
            { name: 'B', lat: 1, lng: 1 },
          ],
        }),
    ).expect(404);

    expect(prismaMock.routeStop.deleteMany).not.toHaveBeenCalled();
  });
});

describe('choferes', () => {
  it('crea el chofer y devuelve temporaryPassword sin exponer passwordHash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'd1',
      name: 'Juan Soto',
      email: 'juan@bupesa.cl',
      licenseNumber: 'A-123',
      driverStatus: 'ACTIVE',
      createdAt: new Date('2026-02-01T10:00:00.000Z'),
    });

    const res = await asAdmin(
      request(app)
        .post('/api/company/drivers')
        .send({ name: 'Juan Soto', email: 'juan@bupesa.cl', licenseNumber: 'A-123' }),
    ).expect(201);

    expect(res.body.temporaryPassword).toEqual(expect.any(String));
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(8);
    expect(res.body).not.toHaveProperty('passwordHash');

    const created = prismaMock.user.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(created.data).toMatchObject({
      companyId: 'c1',
      role: 'DRIVER',
      driverStatus: 'ACTIVE',
      mustChangePassword: true,
    });
    // El hash guardado no puede ser la clave en claro.
    expect(created.data.passwordHash).not.toBe(res.body.temporaryPassword);
    expect(created.select).not.toHaveProperty('passwordHash');
  });

  it('lista solo choferes de la empresa del token', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await asAdmin(request(app).get('/api/company/drivers')).expect(200);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', role: 'DRIVER' } }),
    );
  });

  it('actualizar un chofer de otra empresa da 404', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await asAdmin(
      request(app).patch('/api/company/drivers/d-de-otra').send({ driverStatus: 'SUSPENDED' }),
    ).expect(404);

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe('turnos en vivo', () => {
  it('incluye los turnos sin posicion como NO_SIGNAL', async () => {
    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 't1',
        routeId: 'r1',
        driverId: 'd1',
        startedAt: new Date('2026-02-01T10:00:00.000Z'),
        route: { name: 'Penaflor - Santiago' },
        driver: { name: 'Juan Soto' },
      },
      {
        id: 't2',
        routeId: 'r1',
        driverId: 'd2',
        startedAt: new Date('2026-02-01T10:05:00.000Z'),
        route: { name: 'Penaflor - Santiago' },
        driver: { name: 'Ana Diaz' },
      },
    ]);

    upsertLiveTrip({
      tripId: 't1',
      routeId: 'r1',
      companyId: 'c1',
      driverId: 'd1',
      driverName: 'Juan Soto',
      busPlate: null,
      busSeats: null,
      busAssetSlug: null,
      lat: -33.6,
      lng: -70.9,
      speed: 40,
      heading: 180,
      recordedAt: new Date(),
      lastPersistedAt: Date.now(),
    });

    const res = await asAdmin(request(app).get('/api/company/trips/live')).expect(200);

    expect(prismaMock.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', status: 'IN_TRANSIT' } }),
    );
    expect(res.body.trips).toHaveLength(2);
    expect(res.body.trips[0]).toMatchObject({
      tripId: 't1',
      freshness: 'LIVE',
      position: { lat: -33.6, lng: -70.9 },
    });
    expect(res.body.trips[1]).toMatchObject({
      tripId: 't2',
      freshness: 'NO_SIGNAL',
      position: null,
      recordedAt: null,
      ageSeconds: null,
    });
  });
});
