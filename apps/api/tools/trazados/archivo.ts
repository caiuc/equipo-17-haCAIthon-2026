/**
 * Genera el fuente de `prisma/seed/data/trazados.ts`.
 *
 * Puro: entra la lista de trazados, sale el texto del archivo. Quien lo escribe
 * en disco es index.ts, para que esto se pueda testear sin tocar el sistema de
 * archivos ni la base.
 */

export type EntradaTrazado = {
  companySlug: string;
  routeCode: string;
  polilinea: string;
};

/** La clave del mapa. Ver el comentario del archivo generado sobre por que no es el id. */
export const claveTrazado = (companySlug: string, routeCode: string): string =>
  `${companySlug}:${routeCode}`;

/**
 * Un encoded polyline solo usa ASCII 63..126, asi que la comilla simple (39) no
 * puede aparecer y la barra invertida (92) si. Se escapan las dos igual: que hoy
 * una sea imposible no es razon para generar codigo que se rompa si el formato
 * cambia.
 */
const comoLiteral = (valor: string): string =>
  `'${valor.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const CABECERA = `/**
 * Trazado real de cada recorrido por las calles, en encoded polyline de Google.
 *
 * ARCHIVO GENERADO -- no se edita a mano. Para regenerarlo, contra una base que
 * ya tenga los trazados calculados:
 *
 *   pnpm --filter @equipo17/api trazados            # los calcula y los guarda
 *   pnpm --filter @equipo17/api trazados -- --export # vuelca la base a este archivo
 *
 * SI SE COMMITEA, y es el punto entero de que exista. Tres razones:
 *
 *  1. Es la unica forma de que los trazados lleguen a produccion. La base de
 *     produccion es un RDS privado dentro de la VPC: el script no puede pegarle
 *     desde fuera. Lo que si corre alla es el seed (docker-entrypoint.sh ejecuta
 *     dist/seed.js con SEED_DEMO_DATA=true), asi que el trazado viaja con el.
 *  2. Cada llamada a la Routes API se cobra. Calcularlas una vez y versionarlas
 *     sale mas barato que recalcularlas por entorno, y es REPRODUCIBLE: dos
 *     entornos con el mismo commit dibujan exactamente el mismo camino.
 *  3. Un clone fresco del repo funciona sin la clave de Routes API.
 *
 * PESA ~200 KB de fuente, y esta bien asi. No lo "optimices" borrandolo ni
 * moviendolo a un JSON descargable: sin este archivo las micros de produccion
 * vuelven a cruzar cerros, campos y el rio en linea recta.
 *
 * La clave es \`empresa:codigo\` y NO el id del recorrido: el id es un cuid que
 * se regenera en cada \`pnpm db:reset\`, mientras que (companySlug, routeCode) es
 * la misma clave natural con la que el seed upsertea el recorrido.
 *
 * Un recorrido que no este aca simplemente no tiene trazado, y eso no rompe
 * nada: el mapa y el simulador caen a la interpolacion recta entre paraderos.
 */`;

export const renderizarTrazados = (entradas: EntradaTrazado[]): string => {
  const ordenadas = [...entradas].sort((a, b) =>
    claveTrazado(a.companySlug, a.routeCode).localeCompare(
      claveTrazado(b.companySlug, b.routeCode),
    ),
  );

  const filas = ordenadas
    .map(
      (entrada) =>
        `  ${comoLiteral(claveTrazado(entrada.companySlug, entrada.routeCode))}:\n` +
        `    ${comoLiteral(entrada.polilinea)},`,
    )
    .join('\n');

  return `${CABECERA}

export const TRAZADOS: Record<string, string> = {
${filas}
};

/**
 * El trazado de un recorrido, o null si no tiene. Nunca lanza: la ausencia de
 * trazado es un caso normal, no un error.
 */
export const trazadoDe = (companySlug: string, routeCode: string): string | null =>
  TRAZADOS[\`\${companySlug}:\${routeCode}\`] ?? null;
`;
};
