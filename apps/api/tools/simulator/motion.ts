/**
 * Cinematica de una micro simulada: velocidad, frenado, detencion y rumbo.
 *
 * Todo aca es puro (entra estado, sale estado): el reloj y el azar llegan como
 * parametros. Asi el movimiento se puede testear sin levantar nada.
 *
 * La micro no avanza sobre los paraderos sino sobre un TRAZADO (ver abajo): con
 * `Route.pathPolyline` calculado son los vertices del camino real, y sin el son
 * los paraderos, como siempre. La cinematica es la misma en los dos casos.
 */
import { haversineMeters } from '../../src/lib/geo.js';
import { decodePolyline } from '../../src/lib/polyline.js';
import type { EstadoMovimiento, Punto, Trazado } from './types.js';

/**
 * La velocidad sale de la GEOMETRIA del recorrido, no de una columna nueva en la
 * base: un recorrido con tramos de 6 km es interurbano y uno con tramos de 800 m
 * es urbano, y eso ya esta en los paraderos que cargo la empresa.
 */
export const TRAMO_INTERURBANO_M = 4_000;
export const TRAMO_URBANO_M = 1_200;
export const VELOCIDAD_INTERURBANA_KMH = 78;
export const VELOCIDAD_RURAL_KMH = 52;
export const VELOCIDAD_URBANA_KMH = 32;

/** Variacion por micro, fijada UNA vez al armar la flota (ver `variacionDe`). */
export const VARIACION_MAXIMA = 0.15;

/** Ruido por tick: solo para que no parezca un metronomo. */
const RUIDO_MAXIMO = 0.06;

/** Desde esta distancia al paradero la micro empieza a frenar. */
const RADIO_FRENADO_M = 220;

/**
 * Piso del frenado. Nunca llega a 0 en marcha: una micro congelada a 40 m del
 * paradero se ve como un cuelgue de la app, no como una micro frenando.
 */
const FRENADO_MINIMO = 0.28;

/** Probabilidad de detenerse al cruzar un paradero. */
export const PROBABILIDAD_PARADA = 0.45;

export const PARADA_MIN_MS = 5_000;
export const PARADA_MAX_MS = 14_000;

/** Movimiento por debajo de esto no define rumbo: se conserva el anterior. */
const MOVIMIENTO_MINIMO_GRADOS = 1e-6;

/** Cuanto pesa el rumbo nuevo contra el viejo. Suaviza el giro sin arrastrarlo. */
const MEZCLA_RUMBO = 0.45;

export const normalizarAngulo = (grados: number): number => ((grados % 360) + 360) % 360;

/** Rumbo en grados entre dos puntos, para que el icono apunte hacia donde va. */
export const rumboEntre = (a: Punto, b: Punto): number => {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x =
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return normalizarAngulo(Math.atan2(y, x) / rad);
};

/**
 * Mezcla dos rumbos por el camino corto: de 350° a 10° son 20° a la derecha, no
 * 340° a la izquierda. Sin esto el sprite gira al reves al cruzar el norte.
 */
export const mezclarAngulo = (desde: number, hasta: number, factor: number): number => {
  const delta = ((normalizarAngulo(hasta) - normalizarAngulo(desde) + 540) % 360) - 180;
  return normalizarAngulo(desde + delta * factor);
};

export const largosDeTramos = (stops: Punto[]): number[] => {
  const largos: number[] = [];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const desde = stops[i];
    const hasta = stops[i + 1];
    if (!desde || !hasta) continue;
    // Minimo 1 m: dos paraderos con la misma coordenada dividirian por cero.
    largos.push(Math.max(1, haversineMeters(desde, hasta)));
  }
  return largos;
};

export const tramoPromedioM = (stops: Punto[]): number => {
  const largos = largosDeTramos(stops);
  if (largos.length === 0) return 0;
  return largos.reduce((suma, largo) => suma + largo, 0) / largos.length;
};

export const velocidadCruceroKmh = (stops: Punto[]): number => {
  const promedio = tramoPromedioM(stops);
  if (promedio > TRAMO_INTERURBANO_M) return VELOCIDAD_INTERURBANA_KMH;
  if (promedio < TRAMO_URBANO_M) return VELOCIDAD_URBANA_KMH;
  return VELOCIDAD_RURAL_KMH;
};

/**
 * Variacion propia de cada micro, en [1-VARIACION, 1+VARIACION]. Se aplica UNA
 * vez al armar la flota: si se sorteara por tick, la misma micro oscilaria entre
 * 40 y 80 km/h y en pantalla se veria rota.
 */
export const variacionDe = (sorteo: number): number => 1 + (sorteo * 2 - 1) * VARIACION_MAXIMA;

export const interpolar = (a: Punto, b: Punto, t: number): Punto => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

const puntoEn = (puntos: Punto[], tramo: number, avance: number): Punto => {
  const a = puntos[tramo];
  const b = puntos[tramo + 1];
  if (!a) return { lat: 0, lng: 0 };
  if (!b) return a;
  return interpolar(a, b, Math.min(1, Math.max(0, avance)));
};

// --- Trazado: por donde avanza realmente la micro ---

/**
 * Distancia desde el final de cada tramo hasta el proximo paradero.
 *
 * Es lo que permite frenar bien sobre un camino real: entre dos paraderos hay
 * decenas de vertices de la polilinea, y frenar al llegar a cada uno dejaria la
 * micro avanzando al paso de un peaton toda la ruta. Se recorre al reves porque
 * cada tramo se apoya en el resultado del siguiente.
 */
const distanciasAlParadero = (largos: number[], esParadero: boolean[]): number[] => {
  const alParadero = new Array<number>(largos.length).fill(0);

  for (let tramo = largos.length - 2; tramo >= 0; tramo -= 1) {
    // El tramo termina en el punto tramo+1: si ese es paradero, no falta nada.
    alParadero[tramo] = esParadero[tramo + 1]
      ? 0
      : (largos[tramo + 1] ?? 0) + (alParadero[tramo + 1] ?? 0);
  }

  return alParadero;
};

const armar = (puntos: Punto[], esParadero: boolean[], porCalles: boolean): Trazado => {
  const largos = largosDeTramos(puntos);
  return { puntos, largos, alParadero: distanciasAlParadero(largos, esParadero), porCalles };
};

/** El comportamiento de siempre: la micro va de paradero a paradero en recta. */
export const trazadoDeParaderos = (stops: Punto[]): Trazado =>
  armar(
    stops,
    stops.map(() => true),
    false,
  );

/**
 * A que vertice del camino corresponde cada paradero.
 *
 * La polilinea que devuelve la Routes API pasa CERCA de cada paradero pero no
 * por su coordenada exacta (las nuestras son aproximadas, geocodificadas a la
 * localidad), asi que hay que engancharlos al vertice mas cercano. La busqueda
 * avanza y no vuelve atras: un recorrido que pasa dos veces por la misma esquina
 * asignaria el segundo paradero al vertice de la primera pasada y la micro
 * frenaria en el lugar equivocado.
 */
const engancharParaderos = (camino: Punto[], stops: Punto[]): boolean[] => {
  const esParadero = camino.map(() => false);
  const ultimo = camino.length - 1;
  // Origen y destino no se buscan: la polilinea nace y muere en ellos.
  esParadero[0] = true;
  esParadero[ultimo] = true;

  let desde = 1;
  for (const stop of stops.slice(1, -1)) {
    let mejor = desde;
    let mejorDistancia = Infinity;

    for (let i = desde; i < ultimo; i += 1) {
      const vertice = camino[i];
      if (!vertice) continue;
      const distancia = haversineMeters(stop, vertice);
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia;
        mejor = i;
      }
    }

    esParadero[mejor] = true;
    // Estrictamente creciente: dos paraderos no pueden caer en el mismo vertice
    // o el tramo entre ellos tendria largo cero.
    desde = Math.min(mejor + 1, ultimo);
  }

  return esParadero;
};

/**
 * El trazado de este recorrido.
 *
 * Con `pathPolyline` calculado la micro circula por las calles; sin el, cae a la
 * interpolacion entre paraderos. La caida NO es un caso de error: hay recorridos
 * a los que el script de trazados no les encontro camino a proposito, y ninguno
 * de ellos puede quedarse fuera del mapa por eso.
 */
export const construirTrazado = (stops: Punto[], pathPolyline: string | null): Trazado => {
  if (!pathPolyline) return trazadoDeParaderos(stops);

  const camino = decodePolyline(pathPolyline);
  // Un trazado mas corto que los propios paraderos no puede ser el camino: o
  // vino cortado, o quedo de una version vieja del recorrido.
  if (camino.length < 2 || camino.length < stops.length) return trazadoDeParaderos(stops);

  return armar(camino, engancharParaderos(camino, stops), true);
};

export const estadoInicial = (
  trazado: Trazado,
  ubicacion: { tramo: number; avance: number },
): EstadoMovimiento => {
  const a = trazado.puntos[ubicacion.tramo];
  const b = trazado.puntos[ubicacion.tramo + 1];
  return {
    tramo: ubicacion.tramo,
    avance: ubicacion.avance,
    heading: a && b ? rumboEntre(a, b) : 0,
    detenidoHasta: 0,
    punto: puntoEn(trazado.puntos, ubicacion.tramo, ubicacion.avance),
  };
};

export type EntradaAvance = {
  trazado: Trazado;
  estado: EstadoMovimiento;
  /** Crucero de esta micro, con su variacion fija ya aplicada. */
  velocidadKmh: number;
  deltaMs: number;
  ahora: number;
  /** Sorteo en [0,1) para el ruido de velocidad. */
  ruido: number;
  /** Sorteo en [0,1) para decidir si se detiene al cruzar un paradero. */
  sorteoParada: number;
  /** Duracion de esa detencion, ya sorteada. */
  duracionParadaMs: number;
};

export type SalidaAvance = {
  estado: EstadoMovimiento;
  /** Velocidad reportada en este tick. 0 = detenida en un paradero. */
  speedKmh: number;
  /** true cuando piso el ultimo paradero: toca dar la vuelta. */
  fin: boolean;
};

/**
 * Un tick de movimiento.
 *
 * Una micro detenida NO deja de existir: devuelve speed 0 y el mismo punto, y el
 * orquestador la sigue reportando. Dejar de emitir mientras esta parada haria
 * que la frescura se degradara y estariamos mintiendo sobre el motivo: una micro
 * parada en el paradero no es una micro sin senal.
 */
export const avanzar = (entrada: EntradaAvance): SalidaAvance => {
  const { trazado, estado, deltaMs, ahora } = entrada;
  const { puntos, largos, alParadero } = trazado;
  const ultimoTramo = puntos.length - 2;
  if (ultimoTramo < 0) return { estado, speedKmh: 0, fin: true };

  if (estado.detenidoHasta > ahora) {
    // Detenida: conserva el rumbo previo (un vector nulo no tiene direccion).
    return { estado, speedKmh: 0, fin: false };
  }

  const velocidadBase = entrada.velocidadKmh * (1 + (entrada.ruido * 2 - 1) * RUIDO_MAXIMO);

  let tramo = Math.min(estado.tramo, ultimoTramo);
  let avance = estado.avance;
  let detenidoHasta = 0;
  let fin = false;
  let restanteMs = deltaMs;
  let speedKmh = velocidadBase;

  while (restanteMs > 0) {
    const largo = largos[tramo] ?? 1;
    const restanteM = largo * (1 - avance);
    // Se frena contra el PARADERO, no contra el proximo vertice del camino: sobre
    // una polilinea real hay decenas de vertices entre paradero y paradero, y
    // frenar en cada uno dejaria la micro al paso de un peaton todo el recorrido.
    const alProximoParadero = restanteM + (alParadero[tramo] ?? 0);

    const factor =
      alProximoParadero < RADIO_FRENADO_M
        ? Math.max(FRENADO_MINIMO, alProximoParadero / RADIO_FRENADO_M)
        : 1;
    speedKmh = velocidadBase * factor;

    const metros = (speedKmh / 3.6) * (restanteMs / 1000);
    if (metros < restanteM) {
      avance += metros / largo;
      restanteMs = 0;
      break;
    }

    // Cruza el punto: se descuenta el tiempo que costo llegar hasta el.
    restanteMs -= (restanteM / (speedKmh / 3.6)) * 1000;
    if (tramo >= ultimoTramo) {
      avance = 1;
      fin = true;
      break;
    }

    // Solo se detiene si lo que cruzo es un paradero. Un vertice del camino es
    // una curva, no una parada.
    const eraParadero = (alParadero[tramo] ?? 0) === 0;
    tramo += 1;
    avance = 0;
    if (eraParadero && entrada.sorteoParada < PROBABILIDAD_PARADA) {
      detenidoHasta = ahora + entrada.duracionParadaMs;
      speedKmh = 0;
      break;
    }
  }

  const punto = puntoEn(puntos, tramo, avance);
  const movio =
    Math.abs(punto.lat - estado.punto.lat) > MOVIMIENTO_MINIMO_GRADOS ||
    Math.abs(punto.lng - estado.punto.lng) > MOVIMIENTO_MINIMO_GRADOS;

  return {
    estado: {
      tramo,
      avance: Math.min(1, avance),
      // El rumbo se calcula entre puntos EMITIDOS consecutivos, no entre
      // paraderos: si no, el sprite pega saltos de 90° al cambiar de tramo.
      heading: movio
        ? mezclarAngulo(estado.heading, rumboEntre(estado.punto, punto), MEZCLA_RUMBO)
        : estado.heading,
      detenidoHasta,
      punto,
    },
    speedKmh: Math.max(0, speedKmh),
    fin,
  };
};
