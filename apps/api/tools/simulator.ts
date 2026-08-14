/**
 * Simulador de choferes: micros falsas que mueven el mapa de la demo.
 *
 * Habla con el API por HTTP igual que el telefono de un chofer real -- el
 * sistema no usa WebSockets a proposito (ver CLAUDE.md): en zona rural la
 * conexion se corta, y un POST que falla simplemente se reintenta al siguiente
 * tick sin arrastrar el estado de una sesion abierta.
 *
 * Uso:
 *   pnpm --filter @equipo17/api simulate
 *   BUSES=2 API_URL=http://localhost:3000 pnpm --filter @equipo17/api simulate
 *   pnpm --filter @equipo17/api simulate -- --drop-signal
 *
 * Variables de entorno:
 *   API_URL  base del API            (default http://localhost:3000)
 *   BUSES    cuantas micros levantar (default 3, maximo 3: hay 3 choferes)
 *
 * Flags:
 *   --drop-signal   La ultima micro deja de enviar posiciones a los ~40 s.
 *                   Sirve para mostrar en vivo, frente al jurado, la
 *                   degradacion En vivo -> Senal intermitente -> Sin senal
 *                   (30 s y 120 s, FRESHNESS_* de @equipo17/shared). El turno
 *                   queda abierto: la micro no desaparece, se vuelve vieja, que
 *                   es exactamente lo que el sistema promete mostrar.
 *   --once          Termina el turno al llegar al final en vez de reiniciarlo.
 *
 * Ctrl+C finaliza los turnos abiertos antes de salir, para no dejar micros
 * fantasma marcadas como IN_TRANSIT en la base.
 */
import { DRIVER_PING_INTERVAL_MS } from '@equipo17/shared';
import { haversineMeters } from '../src/lib/geo.js';

const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const BUSES = Math.max(1, Math.min(3, Number(process.env.BUSES ?? 3)));
const DROP_SIGNAL = process.argv.includes('--drop-signal');
const ONCE = process.argv.includes('--once');

/** A los 40 s ya se vio el estado "En vivo"; desde ahi empieza a envejecer. */
const DROP_SIGNAL_AFTER_MS = 40_000;

/** Velocidad de crucero de la micro simulada. */
const SPEED_KMH = 60;

const DRIVERS = ['chofer1@bupesa.cl', 'chofer2@bupesa.cl', 'chofer3@bupesa.cl'];
const PASSWORD = 'demo1234';

/** Recorridos preferidos (los del seed). Si faltan, se toma lo que haya. */
const PREFERRED_CODES = ['VIC-IDA', 'PRA-IDA', 'MIR-IDA', 'VIC-VTA', 'PRA-VTA'];

type Stop = { id: string; name: string; lat: number; lng: number; stopOrder: number };
type RouteSummary = { id: string; name: string; code: string };
type RouteDetail = RouteSummary & { stops: Stop[] };

const api = async <T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const texto = await res.text();
  const datos = texto ? (JSON.parse(texto) as unknown) : null;

  if (!res.ok) {
    const mensaje =
      (datos as { error?: { message?: string } } | null)?.error?.message ?? res.statusText;
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${mensaje}`);
  }

  return datos as T;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Rumbo en grados entre dos puntos, para que el icono apunte hacia donde va. */
const headingOf = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x =
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (((Math.atan2(y, x) / rad) % 360) + 360) % 360;
};

type Bus = {
  etiqueta: string;
  email: string;
  token: string;
  route: RouteDetail;
  tripId: string | null;
  /** Indice del paradero desde el que va saliendo. */
  tramo: number;
  /** Avance dentro del tramo actual, 0..1. Es lo que hace suave el movimiento. */
  avance: number;
  mudaEn: number | null;
};

const busesVivos: Bus[] = [];
let cerrando = false;

const iniciarTurno = async (bus: Bus): Promise<void> => {
  try {
    // Los endpoints de chofer envuelven la entidad: { trip: {...} }.
    const { trip } = await api<{ trip: { id: string } }>('/api/driver/trips/start', {
      method: 'POST',
      token: bus.token,
      body: { routeId: bus.route.id },
    });
    bus.tripId = trip.id;
  } catch (error) {
    // Un turno ya abierto de una corrida anterior no es un fallo: se reusa.
    const activo = await api<{ trip: { id: string } | null }>('/api/driver/trips/active', {
      token: bus.token,
    }).catch(() => null);
    if (!activo?.trip?.id) throw error;
    bus.tripId = activo.trip.id;
    console.log(`${bus.etiqueta} reusa el turno abierto ${activo.trip.id}`);
  }
  console.log(`${bus.etiqueta} inicia ${bus.route.code} (turno ${bus.tripId ?? '?'})`);
};

const finalizarTurno = async (bus: Bus): Promise<void> => {
  if (!bus.tripId) return;
  const tripId = bus.tripId;
  bus.tripId = null;
  await api(`/api/driver/trips/${tripId}/end`, { method: 'POST', token: bus.token }).catch(
    (error: unknown) => console.warn(`${bus.etiqueta} no pudo cerrar el turno:`, error),
  );
};

/** Un tick: avanza la posicion interpolada y la reporta. */
const tick = async (bus: Bus): Promise<void> => {
  const stops = bus.route.stops;
  const desde = stops[bus.tramo];
  const hasta = stops[bus.tramo + 1];
  if (!desde || !hasta || !bus.tripId) return;

  const metrosPorTick = (SPEED_KMH / 3.6) * (DRIVER_PING_INTERVAL_MS / 1000);
  const largo = Math.max(1, haversineMeters(desde, hasta));
  bus.avance += metrosPorTick / largo;

  while (bus.avance >= 1 && bus.tramo < stops.length - 2) {
    bus.avance -= 1;
    bus.tramo += 1;
  }

  const a = stops[bus.tramo];
  const b = stops[bus.tramo + 1];
  if (!a || !b) return;

  const t = Math.min(1, bus.avance);
  const latitude = a.lat + (b.lat - a.lat) * t;
  const longitude = a.lng + (b.lng - a.lng) * t;

  if (bus.mudaEn !== null && Date.now() >= bus.mudaEn) {
    // Deja de transmitir sin cerrar el turno: la micro empieza a envejecer.
    return;
  }

  await api(`/api/driver/trips/${bus.tripId}/positions`, {
    method: 'POST',
    token: bus.token,
    body: {
      latitude,
      longitude,
      speed: SPEED_KMH,
      heading: Math.round(headingOf(a, b)),
      timestamp: Date.now(),
    },
  }).catch((error: unknown) => {
    // Un ping perdido es normal en terreno: se reintenta en el siguiente tick.
    console.warn(`${bus.etiqueta} ping fallido:`, (error as Error).message);
  });

  // Llego al ultimo paradero.
  if (bus.tramo === stops.length - 2 && bus.avance >= 1) {
    console.log(`${bus.etiqueta} llego a ${b.name}`);
    await finalizarTurno(bus);
    if (!ONCE && !cerrando) {
      bus.tramo = 0;
      bus.avance = 0;
      await iniciarTurno(bus);
    }
  }
};

const main = async (): Promise<void> => {
  console.log(`Simulador -> ${API_URL} | micros: ${BUSES}${DROP_SIGNAL ? ' | --drop-signal' : ''}`);

  const catalogo = await api<RouteSummary[]>('/api/routes');
  if (catalogo.length === 0)
    throw new Error('No hay recorridos. Corre `pnpm --filter @equipo17/api seed` primero.');

  const elegidos = [
    ...PREFERRED_CODES.map((code) => catalogo.find((route) => route.code === code)).filter(
      (route): route is RouteSummary => Boolean(route),
    ),
    ...catalogo,
  ];

  for (let i = 0; i < BUSES; i += 1) {
    const email = DRIVERS[i % DRIVERS.length] as string;
    const resumen = elegidos[i % elegidos.length] as RouteSummary;
    const route = await api<RouteDetail>(`/api/routes/${resumen.id}`);
    if (route.stops.length < 2) {
      console.warn(`${route.code} no tiene paraderos suficientes, se omite`);
      continue;
    }

    const { token } = await api<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
    });

    const bus: Bus = {
      etiqueta: `[micro ${i + 1} ${route.code}]`,
      email,
      token,
      route,
      tripId: null,
      tramo: 0,
      avance: 0,
      // Solo la ultima micro se queda muda: las demas siguen "En vivo" para
      // que la comparacion en pantalla sea evidente.
      mudaEn: DROP_SIGNAL && i === BUSES - 1 ? Date.now() + DROP_SIGNAL_AFTER_MS : null,
    };

    await iniciarTurno(bus);
    busesVivos.push(bus);
  }

  if (DROP_SIGNAL && busesVivos.length > 0) {
    const muda = busesVivos[busesVivos.length - 1] as Bus;
    console.log(
      `${muda.etiqueta} dejara de transmitir en ${DROP_SIGNAL_AFTER_MS / 1000}s (demo de frescura)`,
    );
  }

  while (!cerrando) {
    await Promise.all(busesVivos.map((bus) => tick(bus)));
    await sleep(DRIVER_PING_INTERVAL_MS);
  }
};

/** Ctrl+C: cerrar los turnos abiertos o quedan micros fantasma IN_TRANSIT. */
const apagar = async (): Promise<void> => {
  if (cerrando) return;
  cerrando = true;
  console.log('\nCerrando turnos abiertos...');
  await Promise.all(busesVivos.map((bus) => finalizarTurno(bus)));
  console.log('Listo.');
  process.exit(0);
};

process.on('SIGINT', () => void apagar());
process.on('SIGTERM', () => void apagar());

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await apagar();
  process.exitCode = 1;
});
