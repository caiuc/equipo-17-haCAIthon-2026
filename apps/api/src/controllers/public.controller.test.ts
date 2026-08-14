import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// vi.hoisted deja el mock listo antes de que app.ts importe lib/prisma.js.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    route: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    trip: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');

const BUPESA = {
  id: 'co_bupesa',
  slug: 'bupesa',
  name: 'Buses Penaflor (Bupesa)',
  color: '#1B5FC1',
  assetSlug: 'bupesa',
};

const vicunaIda = {
  id: 'rt_vic_ida',
  name: 'Vicuna Corriente',
  code: 'VIC-IDA',
  originName: 'Terminal Penaflor',
  destinationName: 'Terminal San Borja',
  company: BUPESA,
  fares: [
    { passengerType: 'ADULT' as const, amountClp: 1350 },
    { passengerType: 'SENIOR' as const, amountClp: 650 },
    { passengerType: 'STUDENT' as const, amountClp: 400 },
  ],
};

/** Recorrido cuya empresa no publico tarifa: el caso "por confirmar". */
const sinTarifa = {
  ...vicunaIda,
  id: 'rt_sin_tarifa',
  code: 'STR-IDA',
  fares: [],
};

describe('GET /api/routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.trip.groupBy.mockResolvedValue([]);
  });

  it('filtra por texto en name o code, insensible a mayusculas', async () => {
    prismaMock.route.findMany.mockResolvedValue([vicunaIda]);

    const res = await request(app).get('/api/routes').query({ q: 'vicuna' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].code).toBe('VIC-IDA');

    expect(prismaMock.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          company: { status: 'ACTIVE' },
          OR: [
            { name: { contains: 'vicuna', mode: 'insensitive' } },
            { code: { contains: 'vicuna', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('incluye activeBuses con los turnos IN_TRANSIT del recorrido', async () => {
    prismaMock.route.findMany.mockResolvedValue([vicunaIda]);
    prismaMock.trip.groupBy.mockResolvedValue([{ routeId: 'rt_vic_ida', _count: { _all: 2 } }]);

    const res = await request(app).get('/api/routes');

    expect(res.status).toBe(200);
    expect(res.body[0].activeBuses).toBe(2);
    expect(prismaMock.trip.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'IN_TRANSIT' }),
      }),
    );
  });

  it('un recorrido sin tarifa publicada llega con fares vacio', async () => {
    prismaMock.route.findMany.mockResolvedValue([sinTarifa]);

    const res = await request(app).get('/api/routes');

    expect(res.status).toBe(200);
    // La lista vacia se pasa tal cual: rellenarla con un 0 le diria al pasajero
    // que el viaje es gratis, cuando lo unico cierto es que no hay dato.
    expect(res.body[0].fares).toEqual([]);
  });

  it('sin resultados devuelve un array vacio, no un 404', async () => {
    prismaMock.route.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/routes').query({ q: 'no-existe' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // Sin recorridos no hay nada que contar: no se golpea Trip.
    expect(prismaMock.trip.groupBy).not.toHaveBeenCalled();
  });
});

describe('GET /api/routes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.trip.groupBy.mockResolvedValue([]);
  });

  it('devuelve el detalle con los paraderos ordenados por stopOrder', async () => {
    prismaMock.route.findFirst.mockResolvedValue({
      ...vicunaIda,
      stops: [
        { id: 'st_0', name: 'Terminal Penaflor', lat: -33.61, lng: -70.8767, stopOrder: 0 },
        { id: 'st_1', name: 'Malloco', lat: -33.6167, lng: -70.8333, stopOrder: 1 },
        { id: 'st_2', name: 'Padre Hurtado', lat: -33.575, lng: -70.8, stopOrder: 2 },
      ],
      schedules: [
        { dayType: 'WEEKDAY', firstDeparture: '4:23', lastDeparture: '21:33' },
        { dayType: 'SATURDAY', firstDeparture: '4:38', lastDeparture: '21:33' },
      ],
    });

    const res = await request(app).get('/api/routes/rt_vic_ida');

    expect(res.status).toBe(200);
    expect(res.body.stops.map((s: { stopOrder: number }) => s.stopOrder)).toEqual([0, 1, 2]);
    expect(res.body.schedules).toHaveLength(2);
    expect(res.body.company.name).toBe('Buses Penaflor (Bupesa)');
    // El mapa pinta la micro con estos dos: si faltan, el marcador queda mudo.
    expect(res.body.company.color).toBe('#1B5FC1');
    expect(res.body.company.assetSlug).toBe('bupesa');
    // El orden lo impone la consulta, no el cliente.
    expect(prismaMock.route.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ stops: { orderBy: { stopOrder: 'asc' } } }),
      }),
    );
  });

  it('devuelve 404 con un id inexistente o de empresa suspendida', async () => {
    prismaMock.route.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/routes/rt_fantasma');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Recorrido no encontrado');
    // La suspension se filtra en la consulta: nunca confirma que el id existe.
    expect(prismaMock.route.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'rt_fantasma', company: { status: 'ACTIVE' } }),
      }),
    );
  });
});
