/**
 * Parseo de flags y variables de entorno. Puro: entra argv y env, sale Opciones.
 */
import type { Opciones } from './types.js';

export const BUSES_POR_DEFECTO = 12;
export const STAGGER_POR_DEFECTO_MS = 250;
export const TIMEOUT_POR_DEFECTO_MS = 10_000;

export const AYUDA = `Simulador de micros (multiempresa).

  BUSES=18 pnpm --filter @equipo17/api simulate -- --seed=17

Flags:
  --seed=N         Semilla del azar. Misma corrida en el ensayo y en la demo.
  --wait-for-api   Espera a que el API conteste antes de arrancar.
  --once           Termina el turno al llegar al terminal en vez de dar la vuelta.
  --cleanup        Cierra los turnos que quedaron abiertos y sale.
  --drop-signal    Garantiza al menos una micro que enmudece (envejece en pantalla).
  --flaky          Garantiza al menos una micro con senal intermitente.
  --all-good       Todas transmiten siempre.
  --stagger-ms=N   Milisegundos entre logins (default ${STAGGER_POR_DEFECTO_MS}).
  --help           Esto.

Variables de entorno:
  BUSES              Cuantas micros (default ${BUSES_POR_DEFECTO}).
  COMPANIES          Slugs separados por coma para filtrar empresas del seed.
  API_URL            Base del API (default http://localhost:3000).
  SIM_PASSWORD       Clave de los choferes (default: la del seed).
  REQUEST_TIMEOUT_MS Corte por peticion (default ${TIMEOUT_POR_DEFECTO_MS}).`;

const valorDe = (argv: string[], nombre: string): string | null => {
  const conIgual = argv.find((arg) => arg.startsWith(`--${nombre}=`));
  if (conIgual) return conIgual.slice(nombre.length + 3);
  const indice = argv.indexOf(`--${nombre}`);
  const siguiente = indice >= 0 ? argv[indice + 1] : undefined;
  return siguiente && !siguiente.startsWith('--') ? siguiente : null;
};

const enteroPositivo = (crudo: string | null | undefined, porDefecto: number): number => {
  if (!crudo) return porDefecto;
  const valor = Number(crudo);
  return Number.isFinite(valor) && valor >= 1 ? Math.floor(valor) : porDefecto;
};

export const parsearOpciones = (
  argv: string[],
  env: Record<string, string | undefined> = {},
): Opciones => {
  const semillaCruda = valorDe(argv, 'seed');
  const semilla =
    semillaCruda !== null && Number.isFinite(Number(semillaCruda)) ? Number(semillaCruda) : null;

  return {
    apiUrl: (env.API_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    // null = usar DEMO_PASSWORD del seed; el env es para bases que no son la de demo.
    password: env.SIM_PASSWORD ?? null,
    buses: enteroPositivo(env.BUSES, BUSES_POR_DEFECTO),
    empresas: (env.COMPANIES ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean),
    semilla,
    esperarApi: argv.includes('--wait-for-api'),
    unaVuelta: argv.includes('--once'),
    limpiar: argv.includes('--cleanup'),
    forzarCorte: argv.includes('--drop-signal'),
    forzarIntermitente: argv.includes('--flaky'),
    todoBueno: argv.includes('--all-good'),
    staggerMs: enteroPositivo(valorDe(argv, 'stagger-ms'), STAGGER_POR_DEFECTO_MS),
    timeoutMs: enteroPositivo(env.REQUEST_TIMEOUT_MS, TIMEOUT_POR_DEFECTO_MS),
  };
};
