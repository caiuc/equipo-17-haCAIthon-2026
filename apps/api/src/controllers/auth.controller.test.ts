import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// vi.hoisted deja el mock listo antes de que app.ts importe lib/prisma.js.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../app.js');
const { hashPassword } = await import('../lib/password.js');

const passenger = {
  id: 'usr_1',
  email: 'ana@example.com',
  name: 'Ana Rivas',
  role: 'PASSENGER' as const,
  companyId: null,
  mustChangePassword: false,
};

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea el pasajero y devuelve 201 con token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(passenger);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ana@example.com', password: 'clave-segura-1', name: 'Ana Rivas' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual(passenger);
    expect(res.body.user.passwordHash).toBeUndefined();
    // El rol nunca se toma del body: el auto-registro solo produce pasajeros.
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'PASSENGER' }) }),
    );
  });

  it('rechaza con 409 si el email ya existe', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'usr_1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ana@example.com', password: 'clave-segura-1', name: 'Ana Rivas' });

    expect(res.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve token cuando las credenciales son correctas', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...passenger,
      passwordHash: await hashPassword('clave-segura-1'),
      company: null,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'clave-segura-1' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual(passenger);
  });

  it('responde igual con email inexistente que con clave equivocada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const desconocido = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'clave-segura-1' });

    prismaMock.user.findUnique.mockResolvedValue({
      ...passenger,
      passwordHash: await hashPassword('clave-segura-1'),
      company: null,
    });
    const claveMala = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'clave-equivocada' });

    expect(desconocido.status).toBe(401);
    expect(claveMala.status).toBe(401);
    // Misma respuesta exacta: si difirieran se podrian enumerar cuentas.
    expect(desconocido.body).toEqual(claveMala.body);
    expect(desconocido.body.error.message).toBe('Credenciales invalidas');
  });

  it('corta con 400 un intento de inyeccion SQL en el email, sin stack trace', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "' OR 1=1; DROP TABLE users; --", password: 'clave-segura-1' });

    expect(res.status).toBe(400);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts:|stack/i);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('devuelve el usuario publico con token valido', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(passenger);
    const registro = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ana@example.com', password: 'clave-segura-1', name: 'Ana Rivas' });

    prismaMock.user.findUnique.mockResolvedValue(passenger);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registro.body.token as string}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(passenger);
  });
});
