import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trip: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    route: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    routeStop: { findUnique: vi.fn(), findMany: vi.fn() },
    position: { create: vi.fn() },
    occupancyReport: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');
const { signToken } = await import('../lib/jwt.js');
const { clearLiveTrips, getLiveTrip, upsertLiveTrip } = await import('../services/liveStore.js');
const { clearCatalogCache } = await import('../services/companyCatalog.service.js');

const ROUTE = { id: 'route-1', name: 'Penaflor - San Borja' };
const STOP = { routeId: ROUTE.id, lat: -33.6, lng: -70.9 };

/** Lo que devuelve company.findMany para poblar el catalogo cacheado. */
const BUPESA_CATALOGO = {
  id: 'company-1',
  slug: 'bupesa',
  name: 'Buses Penaflor (Bupesa)',
  color: '#1B5FC1',
  assetSlug: 'bupesa',
  routes: [
    {
      id: ROUTE.id,
      code: 'VIC-IDA',
      name: ROUTE.name,
      fares: [{ amountClp: 1350 }],
    },
  ],
};

const driverToken = signToken({ sub: 'driver-1', role: 'DRIVER', companyId: 'company-1' });

type BusOverrides = {
  tripId?: string;
  routeId?: string;
  companyId?: string;
  lat?: number;
  lng?: number;
  busPlate?: string | null;
  busSeats?: number | null;
  busAssetSlug?: string | null;
};

/** Micro a unos cientos de metros del paradero, con la antiguedad que se pida. */
const putBus = (ageMs: number, overrides: BusOverrides = {}) => {
  upsertLiveTrip({
    tripId: 'trip-1',
    routeId: ROUTE.id,
    companyId: 'company-1',
    driverId: 'driver-1',
    driverName: 'Juan Perez',
    busPlate: null,
    busSeats: null,
    busAssetSlug: null,
    lat: -33.605,
    lng: -70.902,
    speed: 42,
    heading: 180,
    recordedAt: new Date(Date.now() - ageMs),
    lastPersistedAt: Date.now(),
    ...overrides,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  clearLiveTrips();
  // Sin esto el segundo test veria las empresas cacheadas por el primero: el
  // catalogo tiene TTL de un minuto y los tests comparten proceso.
  clearCatalogCache();
  prismaMock.route.findUnique.mockResolvedValue(ROUTE);
  prismaMock.route.findFirst.mockResolvedValue(ROUTE);
  prismaMock.routeStop.findUnique.mockResolvedValue(STOP);
  prismaMock.occupancyReport.findMany.mockResolvedValue([]);
  prismaMock.company.findMany.mockResolvedValue([BUPESA_CATALOGO]);
});

describe('GET /api/routes/:id/live', () => {
  it('declara LIVE y entrega distancia cuando la posicion es de hace 5 segundos', async () => {
    putBus(5_000);

    const res = await request(app).get(`/api/routes/${ROUTE.id}/live`).query({ stopId: 'stop-1' });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.outOfService).toBe(false);
    expect(res.body.stopId).toBe('stop-1');
    expect(typeof res.body.serverTime).toBe('string');

    const [bus] = res.body.buses;
    expect(bus.freshness).toBe('LIVE');
    expect(bus.ageSeconds).toBeLessThanOrEqual(6);
    expect(typeof bus.distanceMeters).toBe('number');
    expect(bus.distanceMeters).toBeGreaterThan(0);
    expect(typeof bus.recordedAt).toBe('string');
  });

  it('declara INTERMITTENT a los 60 segundos, todavia con distancia', async () => {
    putBus(60_000);

    const res = await request(app).get(`/api/routes/${ROUTE.id}/live`).query({ stopId: 'stop-1' });

    expect(res.status).toBe(200);
    const [bus] = res.body.buses;
    expect(bus.freshness).toBe('INTERMITTENT');
    expect(bus.ageSeconds).toBeGreaterThanOrEqual(59);
    expect(typeof bus.distanceMeters).toBe('number');
  });

  it('declara NO_SIGNAL a los 5 minutos y NO calcula distancia', async () => {
    putBus(5 * 60_000);

    const res = await request(app).get(`/api/routes/${ROUTE.id}/live`).query({ stopId: 'stop-1' });

    expect(res.status).toBe(200);
    const [bus] = res.body.buses;
    expect(bus.freshness).toBe('NO_SIGNAL');
    // La distancia se calla: una posicion vieja no puede fingir precision.
    expect(bus.distanceMeters).toBeNull();
    expect(bus.ageSeconds).toBeGreaterThanOrEqual(299);
  });

  it('marca outOfService cuando no hay ninguna micro transmitiendo', async () => {
    const res = await request(app).get(`/api/routes/${ROUTE.id}/live`);

    expect(res.status).toBe(200);
    expect(res.body.buses).toEqual([]);
    expect(res.body.outOfService).toBe(true);
    expect(res.body.stopId).toBeNull();
  });

  it('404 si el recorrido no existe', async () => {
    prismaMock.route.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/routes/no-existe/live');

    expect(res.status).toBe(404);
  });

  it('400 si el paradero es de otro recorrido', async () => {
    prismaMock.routeStop.findUnique.mockResolvedValue({ ...STOP, routeId: 'otro-recorrido' });

    const res = await request(app).get(`/api/routes/${ROUTE.id}/live`).query({ stopId: 'stop-9' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/driver/trips/:id/positions', () => {
  const activeTrip = {
    id: 'trip-1',
    routeId: ROUTE.id,
    companyId: 'company-1',
    driverId: 'driver-1',
    status: 'IN_TRANSIT',
    driver: { name: 'Juan Perez' },
  };

  it('acepta un lote, guarda la mas reciente en memoria y responde 202', async () => {
    prismaMock.trip.findUnique.mockResolvedValue(activeTrip);
    const now = Date.now();

    const res = await request(app)
      .post('/api/driver/trips/trip-1/positions')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        positions: [
          { latitude: -33.61, longitude: -70.91, timestamp: now - 8_000 },
          { latitude: -33.605, longitude: -70.902, speed: 40, timestamp: now - 2_000 },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ ok: true, accepted: 2 });
    expect(typeof res.body.receivedAt).toBe('string');

    const stored = getLiveTrip('trip-1');
    expect(stored?.lat).toBe(-33.605);
    expect(stored?.lng).toBe(-70.902);
    // Primera muestra del turno: baja a Postgres.
    expect(prismaMock.position.create).toHaveBeenCalledTimes(1);
  });

  it('404 al postear sobre el turno de otro chofer', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ ...activeTrip, driverId: 'otro-chofer' });

    const res = await request(app)
      .post('/api/driver/trips/trip-1/positions')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ latitude: -33.6, longitude: -70.9 });

    expect(res.status).toBe(404);
    expect(getLiveTrip('trip-1')).toBeUndefined();
  });

  it('descarta posiciones con timestamp futuro', async () => {
    prismaMock.trip.findUnique.mockResolvedValue(activeTrip);

    const res = await request(app)
      .post('/api/driver/trips/trip-1/positions')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ latitude: -33.6, longitude: -70.9, timestamp: Date.now() + 10 * 60_000 });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(0);
    // Un reloj adelantado no debe dejar una micro falsamente "fresca".
    expect(getLiveTrip('trip-1')).toBeUndefined();
    expect(prismaMock.position.create).not.toHaveBeenCalled();
  });

  it('409 si el turno ya no esta en transito', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({ ...activeTrip, status: 'COMPLETED' });

    const res = await request(app)
      .post('/api/driver/trips/trip-1/positions')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ latitude: -33.6, longitude: -70.9 });

    expect(res.status).toBe(409);
  });
});
