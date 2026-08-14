/**
 * El escritor del seed: lo unico de este directorio que toca Postgres.
 *
 * Los datos viven en `data/`, que no conoce Prisma (ver data/index.ts). Aqui
 * solo hay upserts y el resumen por consola.
 *
 * Es idempotente y esta pensado para correrse en cada despliegue:
 *   - Company por slug, User por email, Bus por (companyId, plate) y Route por
 *     (companyId, code) se upsertean.
 *   - RouteStop, Schedule y Fare se borran y se recrean dentro de un
 *     $transaction: la lista sembrada es la unica verdad, y asi la corrida N+1
 *     deja exactamente lo mismo que la corrida 1. En particular, una tarifa que
 *     la empresa deja de publicar desaparece de la base en vez de quedarse
 *     colgada pareciendo vigente.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/lib/password.js';
import { BANNER } from './banner.js';
import { COMPANIES, DEMO_PASSWORD, PASAJERO, SUPERADMIN } from './data/index.js';
// Se importa del archivo y NO del barril data/index.js a proposito: son 263 KB de
// polilineas, y el simulador importa ese barril para sacar COMPANIES. Colgarlas
// del barril le cargaria a cada micro simulada un cuarto de mega que no usa (el
// simulador recibe el trazado del API, no del seed).
import { trazadoDe } from './data/trazados.js';
import { REGIONS_SEED } from './data/regions.js';
import type { CompanySeed } from './types.js';

const prisma = new PrismaClient();

/** El slug de la empresa es tambien el dominio de correo de sus cuentas. */
const adminEmail = (slug: string): string => `admin@${slug}.cl`;

/** minusculas y sin tildes, para comparar "Peñaflor" con "PEÑAFLOR" o "penaflor". */
const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Siembra el arbol region -> zona y devuelve un indice needle->zona para
 * asignar automaticamente la zona de cada recorrido sembrado, sin tener que
 * declarar `zoneId` a mano en cada uno de los recorridos de las 8 empresas.
 */
const sembrarRegiones = async (): Promise<{ needle: string; zoneId: string }[]> => {
  const indice: { needle: string; zoneId: string }[] = [];

  for (const regionSeed of REGIONS_SEED) {
    const region = await prisma.region.upsert({
      where: { name: regionSeed.name },
      update: {},
      create: { name: regionSeed.name },
    });

    for (const zonaSeed of regionSeed.zones) {
      const zone = await prisma.zone.upsert({
        where: { regionId_name: { regionId: region.id, name: zonaSeed.name } },
        update: {},
        create: { regionId: region.id, name: zonaSeed.name },
      });

      for (const needle of [zonaSeed.name, ...zonaSeed.aliases]) {
        indice.push({ needle: normalizar(needle), zoneId: zone.id });
      }
    }
  }

  // Needles largos primero: "Terminal San Borja" debe ganarle a un needle
  // corto que por casualidad tambien calce como substring.
  return indice.sort((a, b) => b.needle.length - a.needle.length);
};

/** Zona pendiente si ningun needle calza: nunca se inventa una. */
const matchZone = (
  indice: { needle: string; zoneId: string }[],
  ...textos: string[]
): string | null => {
  for (const texto of textos) {
    const normalizado = normalizar(texto);
    const match = indice.find((entry) => normalizado.includes(entry.needle));
    if (match) return match.zoneId;
  }
  return null;
};

const sembrarEmpresa = async (
  seed: CompanySeed,
  passwordHash: string,
  indiceZonas: { needle: string; zoneId: string }[],
): Promise<void> => {
  const ficha = {
    name: seed.name,
    rut: seed.rut,
    kind: seed.kind,
    color: seed.color,
    assetSlug: seed.assetSlug,
    phone: seed.phone,
    website: seed.website,
    sourceUrl: seed.sourceUrl,
    sourceCheckedAt: new Date(seed.sourceCheckedAt),
    status: 'ACTIVE' as const,
  };
  const company = await prisma.company.upsert({
    where: { slug: seed.slug },
    update: ficha,
    create: { slug: seed.slug, ...ficha },
  });

  const admin = {
    name: seed.adminName,
    role: 'COMPANY_ADMIN' as const,
    companyId: company.id,
    licenseNumber: null,
    driverStatus: null,
    mustChangePassword: false,
  };
  await prisma.user.upsert({
    where: { email: adminEmail(seed.slug) },
    update: { ...admin, passwordHash },
    create: { email: adminEmail(seed.slug), passwordHash, ...admin },
  });

  for (const driver of seed.drivers) {
    const datos = {
      name: driver.name,
      role: 'DRIVER' as const,
      companyId: company.id,
      licenseNumber: driver.licenseNumber,
      // El chofer sembrado ya viene aprobado: la demo no pasa por la aprobacion.
      driverStatus: 'ACTIVE' as const,
      mustChangePassword: false,
    };
    await prisma.user.upsert({
      where: { email: driver.email },
      update: { ...datos, passwordHash },
      create: { email: driver.email, passwordHash, ...datos },
    });
  }

  for (const bus of seed.buses) {
    const datos = { seats: bus.seats, assetSlug: bus.assetSlug, active: true };
    await prisma.bus.upsert({
      where: { companyId_plate: { companyId: company.id, plate: bus.plate } },
      update: datos,
      create: { companyId: company.id, plate: bus.plate, ...datos },
    });
  }

  for (const routeSeed of seed.routes) {
    // El trazado por calles viaja con el seed porque es la unica via para que
    // llegue a produccion: su base es un RDS privado y tools/trazados no la
    // alcanza, pero el seed si corre alla (docker-entrypoint.sh -> dist/seed.js).
    const trazado = trazadoDe(seed.slug, routeSeed.code);
    const datos = {
      name: routeSeed.name,
      originName: routeSeed.originName,
      destinationName: routeSeed.destinationName,
      active: true,
      // Se omite la clave cuando no hay trazado, en vez de mandar null: asi un
      // recorrido al que se le calculo el trazado en esta base pero que aun no
      // esta en el archivo generado no lo pierde en la proxima siembra.
      ...(trazado ? { pathPolyline: trazado } : {}),
      // Pendiente (null) si ningun needle calza: nunca se inventa una zona.
      zoneId: matchZone(indiceZonas, routeSeed.originName, routeSeed.destinationName),
    };
    const route = await prisma.route.upsert({
      where: { companyId_code: { companyId: company.id, code: routeSeed.code } },
      update: datos,
      create: { companyId: company.id, code: routeSeed.code, ...datos },
    });

    await prisma.$transaction([
      prisma.routeStop.deleteMany({ where: { routeId: route.id } }),
      prisma.routeStop.createMany({
        data: routeSeed.stops.map((stop, index) => ({
          routeId: route.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          stopOrder: index,
        })),
      }),
      prisma.schedule.deleteMany({ where: { routeId: route.id } }),
      prisma.schedule.createMany({
        data: routeSeed.schedules.map((schedule) => ({ routeId: route.id, ...schedule })),
      }),
      prisma.fare.deleteMany({ where: { routeId: route.id } }),
      prisma.fare.createMany({
        data: routeSeed.fares.map((fare) => ({ routeId: route.id, ...fare })),
      }),
    ]);
  }
};

const main = async (): Promise<void> => {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const indiceZonas = await sembrarRegiones();

  for (const cuenta of [
    { ...SUPERADMIN, role: 'SUPERADMIN' as const },
    { ...PASAJERO, role: 'PASSENGER' as const },
  ]) {
    const datos = {
      name: cuenta.name,
      role: cuenta.role,
      companyId: null,
      licenseNumber: null,
      driverStatus: null,
      mustChangePassword: false,
    };
    await prisma.user.upsert({
      where: { email: cuenta.email },
      update: { ...datos, passwordHash },
      create: { email: cuenta.email, passwordHash, ...datos },
    });
  }

  for (const seed of COMPANIES) await sembrarEmpresa(seed, passwordHash, indiceZonas);

  const suma = (fn: (empresa: CompanySeed) => number): number =>
    COMPANIES.reduce((acc, empresa) => acc + fn(empresa), 0);
  const rutas = (fn: (ruta: CompanySeed['routes'][number]) => number) => (empresa: CompanySeed) =>
    empresa.routes.reduce((acc, ruta) => acc + fn(ruta), 0);

  const sinTarifa = COMPANIES.filter((empresa) =>
    empresa.routes.every((ruta) => ruta.fares.length === 0),
  );
  const sinHorario = COMPANIES.filter((empresa) =>
    empresa.routes.every((ruta) => ruta.schedules.length === 0),
  );

  console.log(BANNER);
  console.table(
    COMPANIES.map((empresa) => ({
      empresa: empresa.name,
      tipo: empresa.kind,
      recorridos: empresa.routes.length,
      paraderos: empresa.routes.reduce((acc, ruta) => acc + ruta.stops.length, 0),
      choferes: empresa.drivers.length,
      buses: empresa.buses.length,
      tarifa: empresa.routes.some((ruta) => ruta.fares.length > 0) ? 'publicada' : 'por confirmar',
      horario: empresa.routes.some((ruta) => ruta.schedules.length > 0)
        ? 'publicado'
        : 'por confirmar',
      consultada: empresa.sourceCheckedAt,
    })),
  );

  console.log(`Empresas:   ${COMPANIES.length}`);
  console.log(`Recorridos: ${suma((empresa) => empresa.routes.length)}`);
  console.log(`Paraderos:  ${suma(rutas((ruta) => ruta.stops.length))}`);
  console.log(`Horarios:   ${suma(rutas((ruta) => ruta.schedules.length))}`);
  console.log(`Tarifas:    ${suma(rutas((ruta) => ruta.fares.length))}`);
  console.log(`Choferes:   ${suma((empresa) => empresa.drivers.length)}`);
  console.log(`Buses:      ${suma((empresa) => empresa.buses.length)}`);
  // Si esto no dice 63/63 en el log del despliegue, las micros de ese entorno
  // estan cruzando en linea recta y conviene enterarse aca y no mirando el mapa.
  const trazados = suma(
    (empresa) =>
      empresa.routes.filter((ruta) => trazadoDe(empresa.slug, ruta.code) !== null).length,
  );
  console.log(
    `Trazados:   ${trazados}/${suma((empresa) => empresa.routes.length)} recorridos por calles`,
  );
  console.log(
    `Sin tarifa publicada: ${sinTarifa.length} empresa(s) -> ${sinTarifa.map((e) => e.slug).join(', ') || '-'}`,
  );
  console.log(
    `Sin horario publicado: ${sinHorario.length} empresa(s) -> ${sinHorario.map((e) => e.slug).join(', ') || '-'}`,
  );
  console.log('');
  console.log(`Cuentas de demo, todas con la clave "${DEMO_PASSWORD}":`);
  console.log(`  ${SUPERADMIN.email} (superadmin)   ${PASAJERO.email} (pasajero)`);
  console.log(`  admin@<slug>.cl y chofer<n>@<slug>.cl para cada empresa de la tabla.`);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
