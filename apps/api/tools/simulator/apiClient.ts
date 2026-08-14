/**
 * Cliente HTTP del simulador.
 *
 * Habla con el API igual que el telefono de un chofer real: el sistema no usa
 * WebSockets a proposito (ver CLAUDE.md), asi que aca tampoco. Un POST que falla
 * se reintenta en el siguiente tick sin arrastrar estado de sesion.
 */

/** Respuesta HTTP con codigo: distinta de un fallo de red, y se trata distinto. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Segundos que faltan para que se libere el cupo, si el API los declaro. */
    readonly resetSegundos: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const BACKOFF_BASE_MS = 400;

/**
 * Solo 429 y 5xx se reintentan: un 401 o un 404 ya son respuestas definitivas y
 * repetirlas solo gasta cupo del rate limit.
 */
const transitorio = (status: number): boolean => status === 429 || status >= 500;

const esperaDe = (intento: number): number =>
  // Jitter para que ocho micros que fallaron juntas no vuelvan juntas.
  BACKOFF_BASE_MS * 2 ** (intento - 1) + Math.floor(Math.random() * 250);

/**
 * express-rate-limit con standardHeaders 'draft-7' manda `RateLimit:
 * limit=30, remaining=0, reset=42`. Se acepta tambien la cabecera separada de
 * draft-6 y el Retry-After clasico: el mensaje accionable vale mas que adivinar.
 */
const resetDe = (headers: Headers): number | null => {
  const directo = headers.get('ratelimit-reset') ?? headers.get('retry-after');
  if (directo && Number.isFinite(Number(directo))) return Number(directo);
  const compuesto = headers.get('ratelimit');
  const encontrado = compuesto ? /reset=(\d+)/.exec(compuesto)?.[1] : null;
  return encontrado ? Number(encontrado) : null;
};

export type PedirInit = {
  method?: string;
  body?: unknown;
  token?: string;
  reintentos?: number;
};

export type Cliente = {
  apiUrl: string;
  pedir: <T>(path: string, init?: PedirInit) => Promise<T>;
  login: (email: string, password: string) => Promise<string>;
  esperarApi: (limiteMs?: number) => Promise<void>;
};

export const crearCliente = (opciones: { apiUrl: string; timeoutMs: number }): Cliente => {
  const apiUrl = opciones.apiUrl.replace(/\/$/, '');

  const unIntento = async <T>(path: string, init: PedirInit): Promise<T> => {
    const metodo = init.method ?? 'GET';
    const res = await fetch(`${apiUrl}${path}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(opciones.timeoutMs),
    });

    const texto = await res.text();
    const datos = texto ? (JSON.parse(texto) as unknown) : null;
    if (res.ok) return datos as T;

    const mensaje =
      (datos as { error?: { message?: string } } | null)?.error?.message ?? res.statusText;
    throw new ApiError(
      res.status,
      `${metodo} ${path} -> ${res.status} ${mensaje}`,
      resetDe(res.headers),
    );
  };

  /**
   * Reintentos con backoff y jitter. Contra una URL remota, con varias micros
   * pingueando a la vez, el cuello de botella es abrir la conexion y no el API:
   * un corte por peticion mas backoff absorbe ese pico sin voltear la corrida.
   */
  const pedir = async <T>(path: string, init: PedirInit = {}): Promise<T> => {
    const reintentos = init.reintentos ?? 3;
    let ultimo: unknown = null;

    for (let intento = 0; intento <= reintentos; intento += 1) {
      if (intento > 0) await sleep(esperaDe(intento));

      const resultado = await unIntento<T>(path, init).then(
        (valor) => ({ ok: true as const, valor }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      if (resultado.ok) return resultado.valor;

      const error = resultado.error;
      // La respuesta HTTP ya vino: no es un problema de red.
      if (error instanceof ApiError) {
        if (!transitorio(error.status)) throw error;
        ultimo = error;
        continue;
      }
      // Timeout, DNS, socket cortado o HTML de error de un proxy: se reintenta.
      ultimo = new Error(`${init.method ?? 'GET'} ${path} -> ${(error as Error).message}`);
    }

    throw ultimo ?? new Error(`${init.method ?? 'GET'} ${path} -> fallo sin detalle`);
  };

  const login = async (email: string, password: string): Promise<string> => {
    // Sin reintentos: un 429 se reintenta solo consumiendo mas cupo del limitador.
    const sesion = await pedir<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      reintentos: 0,
    });
    return sesion.token;
  };

  /**
   * Espera a que el API conteste. Sirve para arrancar el simulador junto al
   * servidor sin tener que cronometrar a mano.
   */
  const esperarApi = async (limiteMs = 120_000): Promise<void> => {
    const limite = Date.now() + limiteMs;
    let avisado = false;

    while (Date.now() < limite) {
      const vivo = await pedir('/api/health', { reintentos: 0 }).then(
        () => true,
        () => false,
      );
      if (vivo) {
        if (avisado) console.log('API arriba.');
        return;
      }
      if (!avisado) {
        console.log(`Esperando a ${apiUrl}...`);
        avisado = true;
      }
      await sleep(1_000);
    }

    throw new Error(`El API no respondio en ${Math.round(limiteMs / 1000)}s: ${apiUrl}`);
  };

  return { apiUrl, pedir, login, esperarApi };
};
