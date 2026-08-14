import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// vi.hoisted deja el mock listo antes de que app.ts importe lib/prisma.js.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trip: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    route: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    occupancyReport: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');
const { signToken } = await import('../lib/jwt.js');

const driverToken = signToken({ sub: 'd1', role: 'DRIVER', companyId: 'c1' });

const tripRow = {
  id: 't1',
  routeId: 'r1',
  driverId: 'd1',
  companyId: 'c1',
  status: 'IN_TRANSIT',
  startedAt: new Date('2026-08-14T12:00:00.000Z'),
  endedAt: null,
  route: { name: 'Penaflor - San Borja' },
};

const report = (over: Partial<{ source: string; full: boolean; updatedAt: Date }>) => ({
  tripId: 't1',
  source: 'PASSENGER',
  full: true,
  updatedAt: new Date('2026-08-14T12:05:00.000Z'),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/driver/trips/start', () => {
  it('crea el turno y devuelve 201', async () => {
    prismaMock.route.findFirst.mockResolvedValue({ id: 'r1' });
    prismaMock.trip.findFirst.mockResolvedValue(null);
    prismaMock.trip.create.mockResolvedValue(tripRow);

    const res = await request(app)
      .post('/api/driver/trips/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeId: 'r1' });

    expect(res.status).toBe(201);
    expect(res.body.trip).toMatchObject({ id: 't1', routeId: 'r1', status: 'IN_TRANSIT' });
    // El companyId sale del token, nunca del body.
    expect(prismaMock.trip.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverId: 'd1', companyId: 'c1', routeId: 'r1' }),
      }),
    );
  });

  it('responde 409 si el chofer ya tiene un turno en curso', async () => {
    prismaMock.route.findFirst.mockResolvedValue({ id: 'r1' });
    prismaMock.trip.findFirst.mockResolvedValue(tripRow);

    const res = await request(app)
      .post('/api/driver/trips/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeId: 'r1' });

    expect(res.status).toBe(409);
    expect(res.body.error.details.trip.id).toBe('t1');
    expect(prismaMock.trip.create).not.toHaveBeenCalled();
  });

  it('responde 404 si el recorrido es de otra empresa', async () => {
    // El filtro por companyId hace que un recorrido ajeno no aparezca.
    prismaMock.route.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/driver/trips/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeId: 'r-ajeno' });

    expect(res.status).toBe(404);
    expect(prismaMock.route.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1' }) }),
    );
    expect(prismaMock.trip.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/driver/trips/:id/end', () => {
  it('finaliza el turno propio', async () => {
    prismaMock.trip.findFirst.mockResolvedValue(tripRow);
    prismaMock.trip.update.mockResolvedValue({
      ...tripRow,
      status: 'COMPLETED',
      endedAt: new Date('2026-08-14T13:00:00.000Z'),
    });

    const res = await request(app)
      .post('/api/driver/trips/t1/end')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('COMPLETED');
    expect(res.body.trip.endedAt).toBe('2026-08-14T13:00:00.000Z');
    expect(prismaMock.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 't1', driverId: 'd1' }) }),
    );
  });

  it('responde 404 si el turno no es suyo', async () => {
    prismaMock.trip.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/driver/trips/t9/end')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(404);
    expect(prismaMock.trip.update).not.toHaveBeenCalled();
  });
});

describe('resolucion de ocupacion', () => {
  it('tres votos de pasajeros distintos dejan la micro FULL', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: 't1', status: 'IN_TRANSIT' });
    prismaMock.occupancyReport.upsert.mockResolvedValue({});
    prismaMock.occupancyReport.findMany.mockResolvedValue([
      report({}),
      report({}),
      report({ updatedAt: new Date('2026-08-14T12:06:00.000Z') }),
    ]);

    const res = await request(app)
      .post('/api/trips/t1/occupancy')
      .set('x-device-id', 'dev-3')
      .send({ full: true });

    expect(res.status).toBe(200);
    expect(res.body.occupancy).toEqual({
      status: 'FULL',
      source: 'PASSENGERS',
      reportCount: 3,
      updatedAt: '2026-08-14T12:06:00.000Z',
    });
    expect(prismaMock.occupancyReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId_reporterKey: { tripId: 't1', reporterKey: 'device:dev-3' } },
      }),
    );
  });

  it('el reporte del chofer con full:false manda sobre los tres votos', async () => {
    prismaMock.trip.findFirst.mockResolvedValue({ id: 't1' });
    prismaMock.occupancyReport.upsert.mockResolvedValue({});
    prismaMock.occupancyReport.findMany.mockResolvedValue([
      report({}),
      report({}),
      report({}),
      report({
        source: 'DRIVER',
        full: false,
        updatedAt: new Date('2026-08-14T12:07:00.000Z'),
      }),
    ]);

    const res = await request(app)
      .post('/api/driver/trips/t1/occupancy')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ full: false });

    expect(res.status).toBe(200);
    expect(res.body.occupancy).toMatchObject({
      status: 'NOT_FULL',
      source: 'DRIVER',
      reportCount: 4,
    });
    expect(prismaMock.occupancyReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId_reporterKey: { tripId: 't1', reporterKey: 'driver:d1' } },
        create: expect.objectContaining({ source: 'DRIVER', full: false }),
      }),
    );
  });

  it('un reporte anonimo sin x-device-id responde 400', async () => {
    const res = await request(app).post('/api/trips/t1/occupancy').send({ full: true });

    expect(res.status).toBe(400);
    expect(prismaMock.occupancyReport.upsert).not.toHaveBeenCalled();
  });

  it('no acepta reportes sobre un turno que ya termino', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ id: 't1', status: 'COMPLETED' });

    const res = await request(app)
      .post('/api/trips/t1/occupancy')
      .set('x-device-id', 'dev-1')
      .send({ full: true });

    expect(res.status).toBe(409);
    expect(prismaMock.occupancyReport.upsert).not.toHaveBeenCalled();
  });
});
