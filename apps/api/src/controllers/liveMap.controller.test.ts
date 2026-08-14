import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// vi.hoisted deja el mock listo antes de que app.ts importe lib/prisma.js.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    routeStop: { findUnique: vi.fn() },
    occupancyReport: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');
const { clearLiveTrips, upsertLiveTrip } = await import('../services/liveStore.js');
const { clearCatalogCache } = await import('../services/companyCatalog.service.js');

const PARADERO = { lat: -33.6, lng: -70.9 };

/**
 * Dos empresas en corredores distintos. Bupesa publica tarifa; MuniBus es
 * municipal y gratuito de verdad (0); Talagante no publica tarifa (sin filas).
 */
const CATALOGO = [
  {
    id: 'co_bupesa',
    slug: 'bupesa',
    name: 'Buses Penaflor (Bupesa)',
    color: '#1B5FC1',
    assetSlug: 'bupesa',
    routes: [{ id: 'rt_bupesa', code: 'VIC-IDA', name: 'Vicuna Corriente', fares: [{ amountClp: 1350 }] }],
  },
  {
    id: 'co_munibus',
    slug: 'munibus',
    name: 'MuniBus Paine',
    color: '#BE185D',
    assetSlug: 'munibus',
    routes: [{ id: 'rt_munibus', code: 'T1B', name: 'Rangue', fares: [{ amountClp: 0 }] }],
  },
  {
    id: 'co_talagante',
    slug: 'talagante',
    name: 'Buses Flota Talagante',
    color: '#B3261E',
    assetSlug: 'talagante',
    routes: [{ id: 'rt_talagante', code: 'TAL-IDA', name: 'Talagante - San Borja', fares: [] }],
  },
];

type MicroOverrides = {
  tripId?: string;
  routeId?: string;
  companyId?: string;
  driverName?: string;
  lat?: number;
  lng?: number;
  busPlate?: string | null;
  busSeats?: number | null;
  busAssetSlug?: string | null;
};

const micro = (ageMs: number, overrides: MicroOverrides = {}) => {
  upsertLiveTrip({
    tripId: 'trip-1',
    routeId: 'rt_bupesa',
    companyId: 'co_bupesa',
    driverId: 'driver-1',
    driverName: 'Luis Farias Gonzalez',
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
  clearCatalogCache();
  prismaMock.routeStop.findUnique.mockResolvedValue(PARADERO);
  prismaMock.occupancyReport.findMany.mockResolvedValue([]);
  prismaMock.company.findMany.mockResolvedValue(CATALOGO);
});

describe('GET /api/live/buses', () => {
  it('devuelve micros de varias empresas, cada una con su color y su sprite', async () => {
    micro(3_000, { tripId: 'trip-bupesa' });
    micro(3_000, { tripId: 'trip-munibus', routeId: 'rt_munibus', companyId: 'co_munibus' });

    const res = await request(app).get('/api/live/buses');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.truncated).toBe(false);

    const porEmpresa = Object.fromEntries(
      res.body.buses.map((bus: { company: { slug: string; color: string; assetSlug: string } }) => [
        bus.company.slug,
        bus.company,
      ]),
    );
    expect(porEmpresa.bupesa.color).toBe('#1B5FC1');
    expect(porEmpresa.bupesa.assetSlug).toBe('bupesa');
    expect(porEmpresa.munibus.color).toBe('#BE185D');
    expect(porEmpresa.munibus.assetSlug).toBe('munibus');
  });

  it('una micro NO_SIGNAL nunca encabeza la lista, aunque este mas cerca', async () => {
    // La vieja se inserta PRIMERO y ademas queda mas cerca del paradero: si el
    // orden dependiera del Map o solo de la distancia, encabezaria. No debe.
    micro(5 * 60_000, { tripId: 'trip-vieja', lat: PARADERO.lat, lng: PARADERO.lng });
    micro(3_000, { tripId: 'trip-fresca', lat: -33.65, lng: -70.95 });

    const res = await request(app).get('/api/live/buses').query({ stopId: 'stop-1' });

    expect(res.status).toBe(200);
    expect(res.body.buses[0].tripId).toBe('trip-fresca');
    expect(res.body.buses[0].freshness).toBe('LIVE');
    expect(res.body.buses[1].freshness).toBe('NO_SIGNAL');
  });

  it('la micro sin senal aparece en la lista pero sin distancia', async () => {
    // Ocultarla haria creer que la micro nunca salio. Se muestra, envejecida y
    // sin distancia: calcularla sobre una posicion vieja seria falsa precision.
    micro(5 * 60_000);

    const res = await request(app).get('/api/live/buses').query({ stopId: 'stop-1' });

    expect(res.body.buses).toHaveLength(1);
    expect(res.body.buses[0].freshness).toBe('NO_SIGNAL');
    expect(res.body.buses[0].distanceMeters).toBeNull();
  });

  it('distingue tarifa gratuita (0) de tarifa no publicada (null)', async () => {
    micro(3_000, { tripId: 'trip-munibus', routeId: 'rt_munibus', companyId: 'co_munibus' });
    micro(3_000, { tripId: 'trip-talagante', routeId: 'rt_talagante', companyId: 'co_talagante' });

    const res = await request(app).get('/api/live/buses');

    const porViaje = Object.fromEntries(
      res.body.buses.map((bus: { tripId: string; fareAdultClp: number | null }) => [
        bus.tripId,
        bus.fareAdultClp,
      ]),
    );

    // toBe(0) y toBeNull, NO toBeFalsy: un test con falsy pasaria con el bug
    // puesto, y el bug seria que la interfaz diga "Gratis" donde no sabemos.
    expect(porViaje['trip-munibus']).toBe(0);
    expect(porViaje['trip-talagante']).toBeNull();
  });

  it('recorta por bbox y deja fuera la micro que no esta en el rectangulo', async () => {
    micro(3_000, { tripId: 'trip-dentro', lat: -33.6, lng: -70.9 });
    micro(3_000, { tripId: 'trip-fuera', lat: -33.1, lng: -70.9 });

    const res = await request(app)
      .get('/api/live/buses')
      .query({ bbox: '-71.0,-33.8,-70.5,-33.4' });

    expect(res.status).toBe(200);
    expect(res.body.buses).toHaveLength(1);
    expect(res.body.buses[0].tripId).toBe('trip-dentro');
  });

  it('sin bbox devuelve todas: el primer render ocurre antes de tener limites', async () => {
    micro(3_000, { tripId: 'trip-a', lat: -33.6, lng: -70.9 });
    micro(3_000, { tripId: 'trip-b', lat: -33.1, lng: -70.9 });

    const res = await request(app).get('/api/live/buses');

    expect(res.body.buses).toHaveLength(2);
  });

  it('400 con un bbox invertido, en vez de devolver un mapa vacio en silencio', async () => {
    const res = await request(app)
      .get('/api/live/buses')
      .query({ bbox: '-70.5,-33.4,-71.0,-33.8' });

    expect(res.status).toBe(400);
  });

  it('400 con un bbox de menos de cuatro numeros', async () => {
    const res = await request(app).get('/api/live/buses').query({ bbox: '-71.0,-33.8' });

    expect(res.status).toBe(400);
  });

  it('filtra por companyId', async () => {
    micro(3_000, { tripId: 'trip-bupesa' });
    micro(3_000, { tripId: 'trip-munibus', routeId: 'rt_munibus', companyId: 'co_munibus' });

    const res = await request(app).get('/api/live/buses').query({ companyId: 'co_munibus' });

    expect(res.body.buses).toHaveLength(1);
    expect(res.body.buses[0].company.slug).toBe('munibus');
  });

  it('el sprite del bus manda sobre el de la empresa cuando existe', async () => {
    micro(3_000, { busAssetSlug: 'generico', busPlate: 'JTKR52', busSeats: 19 });

    const res = await request(app).get('/api/live/buses');

    expect(res.body.buses[0].company.assetSlug).toBe('generico');
    expect(res.body.buses[0].plate).toBe('JTKR52');
    expect(res.body.buses[0].seats).toBe(19);
  });

  it('las micros de una empresa suspendida no aparecen, aunque sigan vivas en memoria', async () => {
    prismaMock.company.findMany.mockResolvedValue([CATALOGO[0]]);
    micro(3_000, { tripId: 'trip-bupesa' });
    micro(3_000, { tripId: 'trip-munibus', routeId: 'rt_munibus', companyId: 'co_munibus' });

    const res = await request(app).get('/api/live/buses');

    expect(res.body.buses).toHaveLength(1);
    expect(res.body.buses[0].company.slug).toBe('bupesa');
  });

  it('limit recorta y marca truncated, conservando el total real', async () => {
    micro(3_000, { tripId: 'trip-a' });
    micro(3_000, { tripId: 'trip-b' });
    micro(3_000, { tripId: 'trip-c' });

    const res = await request(app).get('/api/live/buses').query({ limit: 2 });

    expect(res.body.buses).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.truncated).toBe(true);
  });

  it('solo expone el nombre de pila del chofer', async () => {
    // El endpoint devuelve todas las micros de todas las empresas de una region
    // en una sola respuesta publica: el nombre completo lo convertiria en un
    // padron de choferes descargable cada cinco segundos.
    micro(3_000);

    const res = await request(app).get('/api/live/buses');

    expect(res.body.buses[0].driverName).toBe('Luis');
  });

  it('sin micros vivas responde 200 con lista vacia, no 404', async () => {
    const res = await request(app).get('/api/live/buses');

    expect(res.status).toBe(200);
    expect(res.body.buses).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(typeof res.body.serverTime).toBe('string');
  });

  it('responde Cache-Control: no-store', async () => {
    const res = await request(app).get('/api/live/buses');

    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('una sola consulta de ocupacion para todas las micros', async () => {
    micro(3_000, { tripId: 'trip-a' });
    micro(3_000, { tripId: 'trip-b' });
    micro(3_000, { tripId: 'trip-c' });

    await request(app).get('/api/live/buses');

    // El guardia anti N+1: este endpoint lo golpea cada pasajero cada 5 s.
    expect(prismaMock.occupancyReport.findMany).toHaveBeenCalledTimes(1);
  });

  it('el catalogo se consulta una vez para dos requests seguidos', async () => {
    micro(3_000);

    await request(app).get('/api/live/buses');
    await request(app).get('/api/live/buses');

    // Protege el diseno: empresa, color y tarifa cambian una vez al mes, y no
    // tienen por que consultarse en cada poll de cada pasajero.
    expect(prismaMock.company.findMany).toHaveBeenCalledTimes(1);
  });

  it('404 si el stopId no existe', async () => {
    prismaMock.routeStop.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/live/buses').query({ stopId: 'no-existe' });

    expect(res.status).toBe(404);
  });
});
