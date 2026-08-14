import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Prisma se mockea para que los tests corran sin base de datos (y sin Postgres en CI).
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');

const itemFixture = {
  id: 'itm_1',
  title: 'Probar el scaffold',
  done: false,
  createdAt: new Date('2026-08-14T12:40:00.000Z'),
  updatedAt: new Date('2026-08-14T12:40:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('responde ok cuando la base de datos contesta', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('responde 503 cuando la base de datos falla', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('sin conexion'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.db).toBe('down');
  });
});

describe('GET /api/items', () => {
  it('devuelve la lista de items', async () => {
    prismaMock.item.findMany.mockResolvedValue([itemFixture]);

    const res = await request(app).get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Probar el scaffold');
  });
});

describe('POST /api/items', () => {
  it('crea un item valido', async () => {
    prismaMock.item.create.mockResolvedValue(itemFixture);

    const res = await request(app).post('/api/items').send({ title: 'Probar el scaffold' });

    expect(res.status).toBe(201);
    expect(prismaMock.item.create).toHaveBeenCalledWith({
      data: { title: 'Probar el scaffold', done: false },
    });
  });

  it('rechaza un body invalido con 400 y el detalle de zod', async () => {
    const res = await request(app).post('/api/items').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('title');
    expect(prismaMock.item.create).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/items/:id', () => {
  it('borra y devuelve 204', async () => {
    prismaMock.item.delete.mockResolvedValue(itemFixture);

    const res = await request(app).delete('/api/items/itm_1');

    expect(res.status).toBe(204);
    expect(prismaMock.item.delete).toHaveBeenCalledWith({ where: { id: 'itm_1' } });
  });
});

describe('rutas desconocidas', () => {
  it('devuelve 404 con mensaje', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('/api/no-existe');
  });
});
