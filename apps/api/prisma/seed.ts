/**
 * Seed con datos reales de Bupesa (Buses Penaflor, Region Metropolitana).
 *
 * Los recorridos, sus sentidos y sus horarios salen del PDF publico de horarios
 * de la empresa. Cada SENTIDO es un recorrido propio, tal como el PDF los lista
 * en tablas separadas ("desde Terminal Penaflor" / "desde Terminal San Borja").
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │  ATENCION: LOS PARADEROS Y SUS COORDENADAS SON APROXIMADOS.                │
 * │                                                                            │
 * │  El PDF de horarios NO trae paraderos ni coordenadas: solo primera y       │
 * │  ultima salida por tipo de dia. Los puntos de abajo son las localidades    │
 * │  reales del corredor Penaflor -> Santiago, ubicadas a ojo sobre el mapa,   │
 * │  y existen para que la demo tenga una geometria coherente por donde mover  │
 * │  las micros.                                                               │
 * │                                                                            │
 * │  En produccion los paraderos NO se siembran: los carga cada empresa desde  │
 * │  su panel (PUT /api/company/routes/:id/stops). Eso es parte del diseno del │
 * │  sistema, no una omision de este seed.                                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Es idempotente: se puede correr las veces que haga falta (upsert por email y
 * por (companyId, code); paraderos y horarios se reemplazan completos).
 */
import { PrismaClient, type DayType } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';

// --- Paraderos aproximados del corredor (ver ATENCION arriba) ---
type Waypoint = { name: string; lat: number; lng: number };

const WP = {
  TERMINAL_PENAFLOR: { name: 'Terminal Penaflor', lat: -33.61, lng: -70.8767 },
  VICUNA: { name: 'Villa Vicuna, Penaflor', lat: -33.6055, lng: -70.862 },
  PRADERAS: { name: 'Las Praderas, Penaflor', lat: -33.6135, lng: -70.868 },
  MIRAFLORES: { name: 'Miraflores, Penaflor', lat: -33.618, lng: -70.87 },
  TALAGANTE: { name: 'Talagante centro', lat: -33.6647, lng: -70.9281 },
  MALLOCO: { name: 'Malloco', lat: -33.6167, lng: -70.8333 },
  PADRE_HURTADO: { name: 'Padre Hurtado', lat: -33.575, lng: -70.8 },
  AUTOPISTA_SOL: { name: 'Portal Autopista del Sol', lat: -33.59, lng: -70.82 },
  MAIPU: { name: 'Maipu, Camino Melipilla', lat: -33.515, lng: -70.76 },
  CERRILLOS: { name: 'Cerrillos', lat: -33.495, lng: -70.718 },
  ESTACION_CENTRAL: { name: 'Estacion Central', lat: -33.452, lng: -70.683 },
  TERMINAL_SAN_BORJA: { name: 'Terminal San Borja', lat: -33.45, lng: -70.68 },
  CALERA_TANGO: { name: 'Terminal Calera de Tango', lat: -33.6333, lng: -70.7833 },
  SAN_BERNARDO: { name: 'San Bernardo', lat: -33.592, lng: -70.701 },
  LO_ESPEJO: { name: 'Lo Espejo', lat: -33.522, lng: -70.69 },
  LA_CISTERNA: { name: 'La Cisterna, Santa Rosa', lat: -33.538, lng: -70.662 },
  SANTA_ROSA: { name: 'Terminal Santa Rosa', lat: -33.56, lng: -70.642 },
  LA_FLORIDA: { name: 'La Florida', lat: -33.522, lng: -70.599 },
  PUENTE_ALTO: { name: 'Puente Alto centro', lat: -33.6, lng: -70.575 },
  CASA_VIEJAS: { name: 'Casa Viejas', lat: -33.61, lng: -70.56 },
} satisfies Record<string, Waypoint>;

// Troncales reutilizables: el tramo comun Penaflor -> Santiago por Camino Melipilla.
const A_SANTIAGO = [
  WP.MALLOCO,
  WP.PADRE_HURTADO,
  WP.MAIPU,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];
const A_SANTIAGO_EXPRESO = [
  WP.AUTOPISTA_SOL,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

/** El sentido de vuelta recorre los mismos puntos al reves. */
const inverso = (stops: Waypoint[]): Waypoint[] => [...stops].reverse();

type ScheduleSeed = { dayType: DayType; firstDeparture: string; lastDeparture: string };

type RouteSeed = {
  code: string;
  name: string;
  originName: string;
  destinationName: string;
  stops: Waypoint[];
  schedules: ScheduleSeed[];
};

/** Azucar para escribir los horarios como vienen en el PDF: L-V | Sab | Dom. */
const horarios = (
  weekday: [string, string],
  saturday?: [string, string],
  sunday?: [string, string],
): ScheduleSeed[] => {
  const out: ScheduleSeed[] = [
    { dayType: 'WEEKDAY', firstDeparture: weekday[0], lastDeparture: weekday[1] },
  ];
  if (saturday)
    out.push({ dayType: 'SATURDAY', firstDeparture: saturday[0], lastDeparture: saturday[1] });
  if (sunday) out.push({ dayType: 'SUNDAY', firstDeparture: sunday[0], lastDeparture: sunday[1] });
  return out;
};

const PENAFLOR = 'Terminal Penaflor';
const BORJA = 'Terminal San Borja';

const ROUTES: RouteSeed[] = [
  // --- Desde Terminal Penaflor hacia Terminal San Borja ---
  {
    code: 'VIC-IDA',
    name: 'Vicuna Corriente',
    originName: PENAFLOR,
    destinationName: BORJA,
    stops: [WP.TERMINAL_PENAFLOR, WP.VICUNA, ...A_SANTIAGO],
    schedules: horarios(['4:23', '21:33'], ['4:38', '21:33'], ['4:50', '21:08']),
  },
  {
    code: 'PRA-IDA',
    name: 'Praderas Corriente',
    originName: PENAFLOR,
    destinationName: BORJA,
    stops: [WP.TERMINAL_PENAFLOR, WP.PRADERAS, ...A_SANTIAGO],
    schedules: horarios(['4:50', '20:17'], ['4:55', '20:15'], ['5:05', '20:10']),
  },
  {
    code: 'MIR-IDA',
    name: 'Miraflores Corriente',
    originName: PENAFLOR,
    destinationName: BORJA,
    stops: [WP.TERMINAL_PENAFLOR, WP.MIRAFLORES, ...A_SANTIAGO],
    // Sin domingo: asi lo lista el PDF.
    schedules: horarios(['5:20', '19:00'], ['6:00', '19:00']),
  },
  {
    code: 'AUT-VIC-IDA',
    name: 'Autopista Vicuna',
    originName: PENAFLOR,
    destinationName: BORJA,
    stops: [WP.TERMINAL_PENAFLOR, WP.VICUNA, ...A_SANTIAGO_EXPRESO],
    schedules: horarios(['5:00', '18:36']),
  },
  {
    code: 'AUT-PRA-IDA',
    name: 'Autopista Praderas',
    originName: PENAFLOR,
    destinationName: BORJA,
    stops: [WP.TERMINAL_PENAFLOR, WP.PRADERAS, ...A_SANTIAGO_EXPRESO],
    schedules: horarios(['5:20', '19:00']),
  },
  {
    code: 'AUT-MIR-IDA',
    name: 'Autopista Miraflores',
    originName: PENAFLOR,
    destinationName: BORJA,
    stops: [WP.TERMINAL_PENAFLOR, WP.MIRAFLORES, ...A_SANTIAGO_EXPRESO],
    schedules: horarios(['5:30', '18:50']),
  },

  // --- Desde Terminal San Borja hacia Terminal Penaflor (regreso) ---
  {
    code: 'VIC-VTA',
    name: 'Vicuna Corriente (regreso)',
    originName: BORJA,
    destinationName: PENAFLOR,
    stops: inverso([WP.TERMINAL_PENAFLOR, WP.VICUNA, ...A_SANTIAGO]),
    schedules: horarios(['6:05', '23:25'], ['6:30', '23:25'], ['6:30', '23:00']),
  },
  {
    code: 'PRA-VTA',
    name: 'Praderas Corriente (regreso)',
    originName: BORJA,
    destinationName: PENAFLOR,
    stops: inverso([WP.TERMINAL_PENAFLOR, WP.PRADERAS, ...A_SANTIAGO]),
    schedules: horarios(['6:22', '22:00'], ['6:45', '22:00'], ['6:54', '22:00']),
  },
  {
    code: 'MIR-VTA',
    name: 'Miraflores Corriente (regreso)',
    originName: BORJA,
    destinationName: PENAFLOR,
    stops: inverso([WP.TERMINAL_PENAFLOR, WP.MIRAFLORES, ...A_SANTIAGO]),
    schedules: horarios(['6:35', '18:15'], ['7:40', '21:30']),
  },
  {
    code: 'STR-VTA',
    name: 'Sta. Rosa (regreso)',
    originName: BORJA,
    destinationName: 'Terminal Santa Rosa',
    stops: inverso([
      WP.SANTA_ROSA,
      WP.LA_CISTERNA,
      WP.LO_ESPEJO,
      WP.CERRILLOS,
      WP.ESTACION_CENTRAL,
      WP.TERMINAL_SAN_BORJA,
    ]),
    schedules: horarios(['6:20', '21:40'], ['6:40', '21:00'], ['6:31', '22:30']),
  },
  {
    code: 'CAL-VTA',
    name: 'Calera de Tango (regreso)',
    originName: BORJA,
    destinationName: 'Terminal Calera de Tango',
    stops: inverso([
      WP.CALERA_TANGO,
      WP.SAN_BERNARDO,
      WP.LO_ESPEJO,
      WP.CERRILLOS,
      WP.ESTACION_CENTRAL,
      WP.TERMINAL_SAN_BORJA,
    ]),
    schedules: horarios(['5:51', '22:30'], ['6:10', '22:30'], ['6:31', '22:30']),
  },

  // --- Hacia Terminal San Borja desde los otros terminales ---
  {
    code: 'STR-IDA',
    name: 'Sta. Rosa',
    originName: 'Terminal Santa Rosa',
    destinationName: BORJA,
    stops: [
      WP.SANTA_ROSA,
      WP.LA_CISTERNA,
      WP.LO_ESPEJO,
      WP.CERRILLOS,
      WP.ESTACION_CENTRAL,
      WP.TERMINAL_SAN_BORJA,
    ],
    schedules: horarios(['5:00', '20:20']),
  },
  {
    code: 'CAL-IDA',
    name: 'Calera de Tango',
    originName: 'Terminal Calera de Tango',
    destinationName: BORJA,
    stops: [
      WP.CALERA_TANGO,
      WP.SAN_BERNARDO,
      WP.LO_ESPEJO,
      WP.CERRILLOS,
      WP.ESTACION_CENTRAL,
      WP.TERMINAL_SAN_BORJA,
    ],
    schedules: horarios(['4:21', '20:50']),
  },

  // --- Terminal Penaflor <-> Casa Viejas ---
  {
    code: 'VIZ-PA-IDA',
    name: 'Vizcachas por Puente Alto',
    originName: PENAFLOR,
    destinationName: 'Casa Viejas',
    stops: [
      WP.TERMINAL_PENAFLOR,
      WP.MALLOCO,
      WP.CALERA_TANGO,
      WP.SAN_BERNARDO,
      WP.LA_FLORIDA,
      WP.PUENTE_ALTO,
      WP.CASA_VIEJAS,
    ],
    schedules: horarios(['3:55', '19:50']),
  },
  {
    code: 'VIZ-PA-VTA',
    name: 'Vizcachas por Puente Alto (regreso)',
    originName: 'Casa Viejas',
    destinationName: PENAFLOR,
    stops: inverso([
      WP.TERMINAL_PENAFLOR,
      WP.MALLOCO,
      WP.CALERA_TANGO,
      WP.SAN_BERNARDO,
      WP.LA_FLORIDA,
      WP.PUENTE_ALTO,
      WP.CASA_VIEJAS,
    ]),
    schedules: horarios(['5:47', '22:08']),
  },
  {
    code: 'VIZ-ES-IDA',
    name: 'Vizcachas por Espejo',
    originName: PENAFLOR,
    destinationName: 'Casa Viejas',
    stops: [
      WP.TERMINAL_PENAFLOR,
      WP.MALLOCO,
      WP.LO_ESPEJO,
      WP.LA_CISTERNA,
      WP.LA_FLORIDA,
      WP.PUENTE_ALTO,
      WP.CASA_VIEJAS,
    ],
    schedules: horarios(['3:52', '19:44']),
  },
  {
    code: 'VIZ-ES-VTA',
    name: 'Vizcachas por Espejo (regreso)',
    originName: 'Casa Viejas',
    destinationName: PENAFLOR,
    stops: inverso([
      WP.TERMINAL_PENAFLOR,
      WP.MALLOCO,
      WP.LO_ESPEJO,
      WP.LA_CISTERNA,
      WP.LA_FLORIDA,
      WP.PUENTE_ALTO,
      WP.CASA_VIEJAS,
    ]),
    schedules: horarios(['5:47', '21:52']),
  },
];

const USERS = [
  {
    email: 'superadmin@demo.cl',
    name: 'Super Admin',
    role: 'SUPERADMIN' as const,
    deEmpresa: false,
  },
  {
    email: 'admin@bupesa.cl',
    name: 'Admin Bupesa',
    role: 'COMPANY_ADMIN' as const,
    deEmpresa: true,
  },
  {
    email: 'chofer1@bupesa.cl',
    name: 'Luis Farias',
    role: 'DRIVER' as const,
    deEmpresa: true,
    licenseNumber: 'A3-114455',
  },
  {
    email: 'chofer2@bupesa.cl',
    name: 'Marta Nunez',
    role: 'DRIVER' as const,
    deEmpresa: true,
    licenseNumber: 'A3-228877',
  },
  {
    email: 'chofer3@bupesa.cl',
    name: 'Jose Quintana',
    role: 'DRIVER' as const,
    deEmpresa: true,
    licenseNumber: 'A3-330099',
  },
  { email: 'pasajero@demo.cl', name: 'Ana Rivas', role: 'PASSENGER' as const, deEmpresa: false },
];

const main = async (): Promise<void> => {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // El rut es la clave natural estable de la empresa entre corridas.
  const company = await prisma.company.upsert({
    where: { rut: '96.812.340-7' },
    update: { name: 'Buses Penaflor (Bupesa)', status: 'ACTIVE' },
    create: { name: 'Buses Penaflor (Bupesa)', rut: '96.812.340-7', status: 'ACTIVE' },
  });

  for (const user of USERS) {
    const datos = {
      name: user.name,
      role: user.role,
      companyId: user.deEmpresa ? company.id : null,
      licenseNumber: 'licenseNumber' in user ? user.licenseNumber : null,
      // El chofer sembrado ya viene aprobado: la demo no pasa por la aprobacion.
      driverStatus: user.role === 'DRIVER' ? ('ACTIVE' as const) : null,
      mustChangePassword: false,
    };
    await prisma.user.upsert({
      where: { email: user.email },
      update: { ...datos, passwordHash },
      create: { email: user.email, passwordHash, ...datos },
    });
  }

  for (const seed of ROUTES) {
    const route = await prisma.route.upsert({
      where: { companyId_code: { companyId: company.id, code: seed.code } },
      update: {
        name: seed.name,
        originName: seed.originName,
        destinationName: seed.destinationName,
        active: true,
      },
      create: {
        companyId: company.id,
        code: seed.code,
        name: seed.name,
        originName: seed.originName,
        destinationName: seed.destinationName,
        active: true,
      },
    });

    // Paraderos y horarios se reemplazan enteros: la lista sembrada es la unica
    // verdad, y asi la corrida N+1 deja exactamente lo mismo que la corrida 1.
    await prisma.$transaction([
      prisma.routeStop.deleteMany({ where: { routeId: route.id } }),
      prisma.routeStop.createMany({
        data: seed.stops.map((stop, index) => ({
          routeId: route.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          stopOrder: index,
        })),
      }),
      prisma.schedule.deleteMany({ where: { routeId: route.id } }),
      prisma.schedule.createMany({
        data: seed.schedules.map((schedule) => ({ routeId: route.id, ...schedule })),
      }),
    ]);
  }

  const totalStops = ROUTES.reduce((acc, route) => acc + route.stops.length, 0);

  console.log('');
  console.log(`Empresa: ${company.name} (${company.status})`);
  console.log(`Recorridos: ${ROUTES.length}   Paraderos: ${totalStops}`);
  console.log('Paraderos APROXIMADOS: en produccion los carga la empresa desde su panel.');
  console.log('');
  console.log('Credenciales de demo (clave unica para todos):');
  console.table(
    USERS.map((user) => ({
      email: user.email,
      clave: DEMO_PASSWORD,
      rol: user.role,
      empresa: user.deEmpresa ? company.name : '-',
    })),
  );
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
