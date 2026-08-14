/**
 * Calcula el trazado real de cada recorrido y lo guarda en `Route.pathPolyline`.
 *
 * Sin esto el simulador interpola en linea recta entre paraderos y las micros
 * cruzan cerros, campos y el rio. Con esto avanzan por el camino.
 *
 * Es un script de una sola corrida, no parte del API: pega contra la Routes API
 * de Google, que COBRA POR LLAMADA. De ahi las tres reglas de la casa:
 *
 *   1. Idempotente. Un recorrido que ya tiene trazado no se vuelve a pedir. Para
 *      recalcular hay que decirlo con `--force`.
 *   2. Se puede ensayar. `--dry-run` dice cuantas llamadas costaria, sin hacer
 *      ninguna.
 *   3. Un recorrido malo no mata la corrida. Se anota por que fallo y se sigue.
 *
 * Uso:
 *   ROUTES_API_KEY=... pnpm --filter @equipo17/api trazados
 *   pnpm --filter @equipo17/api trazados -- --dry-run
 *   pnpm --filter @equipo17/api trazados -- --force --company=bupesa
 *   pnpm --filter @equipo17/api trazados -- --export
 *
 * El paso `--export` no es opcional cuando cambian los trazados: vuelca la base
 * a `prisma/seed/data/trazados.ts`, que SI se commitea y es la unica via por la
 * que los trazados llegan a produccion (su base es un RDS privado que este
 * script no alcanza; lo que si corre alla es el seed). Sin ese paso, el trabajo
 * queda solo en la maquina de quien corrio el script.
 *
 * La clave sale de ROUTES_API_KEY (en `.env`, que esta gitignoreado). NUNCA se
 * commitea: en los `.env.example` va declarada y vacia.
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LatLng } from '@equipo17/shared';
import { prisma } from '../../src/lib/prisma.js';
import { decodePolyline } from '../../src/lib/polyline.js';
import { renderizarTrazados } from './archivo.js';
import { RoutesApiError, pedirTrazo } from './routesApi.js';
import { largoDelCamino, partirEnTramos, rodeoInverosimil, unirPolilineas } from './tramos.js';

/**
 * Precio publicado del SKU "Compute Routes Essentials" (USD por 1000 llamadas).
 * Solo alimenta el resumen: el numero que manda es el de la consola de Google.
 * Esta aca para que el costo se lea en la salida y no despues en la factura.
 */
const USD_POR_MIL_LLAMADAS = 5;

/** Respiro entre llamadas. No es rate limit, es no abrir 80 conexiones de golpe. */
const PAUSA_MS = 120;

/** Destino de --export. Es un archivo GENERADO, y se commitea (ver su cabecera). */
const ARCHIVO_SEED = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../prisma/seed/data/trazados.ts',
);

const AYUDA = `Calcula el trazado por calles de cada recorrido (Routes API de Google).

  ROUTES_API_KEY=... pnpm --filter @equipo17/api trazados

Flags:
  --dry-run          Dice cuantas llamadas costaria y no hace ninguna.
  --force            Recalcula tambien los recorridos que YA tienen trazado.
  --company=slug     Solo los recorridos de esa empresa.
  --export           Vuelca los trazados de la base a prisma/seed/data/trazados.ts
                     y sale. No llama a la API. Ese archivo SE COMMITEA: es como
                     los trazados llegan a produccion, cuya base no es alcanzable
                     desde aqui. Correr despues de calcular trazados nuevos.
  --help             Esto.

Variables de entorno:
  ROUTES_API_KEY   Clave de servidor con la Routes API habilitada. Obligatoria.
  DATABASE_URL     La base donde escribir.`;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const valorDe = (argv: string[], nombre: string): string | null =>
  argv.find((arg) => arg.startsWith(`--${nombre}=`))?.slice(nombre.length + 3) ?? null;

type Resultado =
  | { estado: 'resuelto'; llamadas: number; km: number; puntos: number }
  | { estado: 'fallo'; llamadas: number; motivo: string };

/**
 * Resuelve UN recorrido.
 *
 * Si cualquiera de sus tramos no da camino, el recorrido entero queda sin
 * trazado: pegar los tramos que si salieron y cerrar el hueco con una recta
 * seria justamente inventar el dato que no tenemos, y ademas dejaria una micro
 * cruzando el rio en el unico punto donde no hay puente. Sin trazado, el
 * simulador cae a interpolar y eso ya se sabe leer.
 */
const resolverRecorrido = async (
  paraderos: LatLng[],
  apiKey: string,
  dryRun: boolean,
): Promise<Resultado & { polilinea?: string }> => {
  const tramos = partirEnTramos(paraderos.length);
  if (tramos.length === 0) {
    return { estado: 'fallo', llamadas: 0, motivo: 'menos de dos paraderos' };
  }
  if (dryRun) {
    return { estado: 'resuelto', llamadas: tramos.length, km: 0, puntos: 0 };
  }

  const trozos: string[] = [];
  let llamadas = 0;

  for (const [orden, tramo] of tramos.entries()) {
    if (llamadas > 0) await sleep(PAUSA_MS);
    llamadas += 1;

    const puntos = paraderos.slice(tramo.inicio, tramo.fin + 1);
    const trazo = await pedirTrazo(puntos, apiKey).catch((error: unknown) => {
      if (error instanceof RoutesApiError) return error;
      return new Error(String((error as Error).message ?? error));
    });

    if (trazo instanceof Error) {
      return { estado: 'fallo', llamadas, motivo: `tramo ${orden + 1}: ${trazo.message}` };
    }
    if (!trazo) {
      return {
        estado: 'fallo',
        llamadas,
        motivo:
          `tramo ${orden + 1} (paraderos ${tramo.inicio}-${tramo.fin}): la Routes API no ` +
          'encontro camino manejable',
      };
    }

    trozos.push(trazo.encodedPolyline);
  }

  const polilinea = unirPolilineas(trozos);
  const camino = decodePolyline(polilinea);
  const metrosCamino = largoDelCamino(camino);
  const metrosRecta = largoDelCamino(paraderos);

  // La Routes API casi nunca dice "no hay camino": ante dos paraderos sin
  // conexion directa devuelve un rodeo enorme con 200. El rodeo es la senal.
  const inverosimil = rodeoInverosimil(metrosCamino, metrosRecta);
  if (inverosimil) return { estado: 'fallo', llamadas, motivo: inverosimil };

  return {
    estado: 'resuelto',
    llamadas,
    km: metrosCamino / 1000,
    puntos: camino.length,
    polilinea,
  };
};

/**
 * Vuelca los trazados de la base al archivo del seed.
 *
 * Se lee de la base y no de lo que se acaba de calcular a proposito: asi el
 * archivo generado refleja SIEMPRE los 63 recorridos y no solo los que resolvio
 * esta corrida. Correrlo despues de un `--company=bupesa` no borraria el resto.
 */
const exportar = async (): Promise<void> => {
  const conTrazado = await prisma.route.findMany({
    where: { pathPolyline: { not: null } },
    select: { code: true, pathPolyline: true, company: { select: { slug: true } } },
  });

  const fuente = renderizarTrazados(
    conTrazado.map((recorrido) => ({
      companySlug: recorrido.company.slug,
      routeCode: recorrido.code,
      polilinea: recorrido.pathPolyline ?? '',
    })),
  );
  await writeFile(ARCHIVO_SEED, fuente, 'utf8');

  const kb = Math.round(Buffer.byteLength(fuente, 'utf8') / 1024);
  console.log(`Exportados ${conTrazado.length} trazados a prisma/seed/data/trazados.ts (${kb} KB)`);
  console.log('Ese archivo SE COMMITEA: es como los trazados llegan a produccion.');
};

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(AYUDA);
    return;
  }

  if (argv.includes('--export')) {
    await exportar();
    return;
  }

  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  const empresa = valorDe(argv, 'company');
  const apiKey = process.env.ROUTES_API_KEY ?? '';

  if (!apiKey && !dryRun) {
    throw new Error(
      'Falta ROUTES_API_KEY. Va en .env (gitignoreado), con una clave de servidor que tenga ' +
        'habilitada la Routes API. Para ver el costo sin gastar: --dry-run',
    );
  }

  const recorridos = await prisma.route.findMany({
    where: {
      active: true,
      ...(force ? {} : { pathPolyline: null }),
      ...(empresa ? { company: { slug: empresa } } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      company: { select: { slug: true } },
      stops: { orderBy: { stopOrder: 'asc' }, select: { lat: true, lng: true } },
    },
    orderBy: [{ companyId: 'asc' }, { code: 'asc' }],
  });

  const yaTenian = force
    ? 0
    : await prisma.route.count({ where: { active: true, pathPolyline: { not: null } } });

  console.log(
    `Recorridos por resolver: ${recorridos.length}` +
      (yaTenian > 0 ? ` (${yaTenian} ya tienen trazado, se saltan; --force los recalcula)` : '') +
      (dryRun ? ' | ENSAYO: no se llama a la API' : ''),
  );
  if (recorridos.length === 0) return;

  const fallidos: { etiqueta: string; motivo: string }[] = [];
  let resueltos = 0;
  let llamadas = 0;

  for (const recorrido of recorridos) {
    const etiqueta = `${recorrido.company.slug} ${recorrido.code}`;
    const paraderos = recorrido.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }));
    const resultado = await resolverRecorrido(paraderos, apiKey, dryRun);
    llamadas += resultado.llamadas;

    if (resultado.estado === 'fallo') {
      fallidos.push({ etiqueta, motivo: resultado.motivo });
      console.warn(`  x ${etiqueta}: ${resultado.motivo} -- queda sin trazado`);
      continue;
    }

    resueltos += 1;
    if (dryRun) {
      const cuantas = resultado.llamadas;
      console.log(
        `  . ${etiqueta}: ${paraderos.length} paraderos -> ${cuantas} ` +
          `peticion${cuantas === 1 ? '' : 'es'}`,
      );
      continue;
    }

    await prisma.route.update({
      where: { id: recorrido.id },
      data: { pathPolyline: resultado.polilinea },
    });
    console.log(
      `  ok ${etiqueta}: ${paraderos.length} paraderos, ${resultado.km.toFixed(1)} km, ` +
        `${resultado.puntos} puntos, ${resultado.llamadas} llamada${resultado.llamadas === 1 ? '' : 's'}`,
    );
  }

  const usd = (llamadas * USD_POR_MIL_LLAMADAS) / 1000;
  console.log('');
  console.log(`Resueltos: ${resueltos}/${recorridos.length}`);
  console.log(
    `Llamadas a la Routes API: ${llamadas}` +
      (dryRun ? ' (ensayo: ninguna hecha)' : '') +
      ` ~ USD ${usd.toFixed(2)} al precio publicado de ${USD_POR_MIL_LLAMADAS}/1000`,
  );

  // El trabajo no esta hecho hasta que sale del Postgres local: produccion se
  // siembra desde el archivo, no desde esta base.
  if (resueltos > 0 && !dryRun) {
    console.log('');
    console.log(
      'Falta volcarlos al seed para que lleguen a produccion:\n' +
        '  pnpm --filter @equipo17/api trazados -- --export',
    );
  }

  if (fallidos.length === 0) return;
  console.log('');
  console.log(`Sin trazado (${fallidos.length}). Siguen funcionando por interpolacion:`);
  for (const fallido of fallidos) console.log(`  ${fallido.etiqueta}: ${fallido.motivo}`);
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
