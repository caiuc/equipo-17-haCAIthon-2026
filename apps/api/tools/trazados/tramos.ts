/**
 * Partir un recorrido en tramos que quepan en una peticion, y volver a pegar las
 * polilineas que devuelve cada uno.
 *
 * Todo aca es puro: entra geometria, sale geometria. Ni red ni Prisma, para que
 * la parte que decide cuantas llamadas se pagan se pueda testear sin gastar una.
 */
import { haversineMeters } from '../../src/lib/geo.js';
import { decodePolyline, encodePolyline } from '../../src/lib/polyline.js';
import type { LatLng } from '@equipo17/shared';

/**
 * La Routes API acepta como maximo 25 `intermediates` por peticion. Con el
 * origen y el destino son 27 puntos: ese es el techo de un tramo.
 */
export const MAXIMO_INTERMEDIOS = 25;
export const PUNTOS_POR_PETICION = MAXIMO_INTERMEDIOS + 2;

/**
 * Cuanto puede estirarse el camino real sobre la linea recta antes de que
 * dejemos de creerle.
 *
 * Un recorrido de verdad anda entre 1,2x y 1,7x la recta: el camino curva, rodea
 * un cerro, entra a un pueblo. Un 3,5x ya no es un camino, es la Routes API
 * buscandole la vuelta a dos paraderos que no estan conectados -- el caso de los
 * dos lados de un rio sin puente, donde devuelve un rodeo de 40 km por el puente
 * de mas abajo en vez de un error. Ese trazado es peor que no tener trazado: la
 * micro se veria yendo a otro pueblo.
 */
export const RODEO_MAXIMO = 3.5;

/**
 * Un rodeo grande sobre pocos metros no significa nada: dos paraderos a 200 m en
 * lados opuestos de una calle de un solo sentido dan 4x sin que nada este mal.
 */
export const RODEO_MINIMO_M = 3_000;

/** Tramo pedido a la API: indices de `stops`, ambos incluidos. */
export type Tramo = { inicio: number; fin: number };

/**
 * Los tramos COMPARTEN el paradero del borde: el que cierra uno abre el
 * siguiente. Sin eso, al pegar las polilineas quedaria un salto en linea recta
 * justo en cada corte, que es exactamente el defecto que venimos a arreglar.
 *
 * Con 61 paraderos y 27 puntos por peticion salen 3 tramos: [0,26] [26,52]
 * [52,60].
 */
export const partirEnTramos = (
  cantidadParaderos: number,
  porPeticion = PUNTOS_POR_PETICION,
): Tramo[] => {
  // Un solo paradero no define ningun camino que pedir.
  if (cantidadParaderos < 2) return [];

  const tramos: Tramo[] = [];
  let inicio = 0;

  while (inicio < cantidadParaderos - 1) {
    const fin = Math.min(inicio + porPeticion - 1, cantidadParaderos - 1);
    tramos.push({ inicio, fin });
    inicio = fin;
  }

  return tramos;
};

/**
 * Pega las polilineas de los tramos en una sola.
 *
 * El primer punto de cada tramo es el ultimo del anterior (comparten paradero),
 * asi que se descarta: repetirlo no rompe el dibujo pero si el calculo de
 * distancias del simulador, que veria un tramo de largo 0.
 */
export const unirPolilineas = (codificadas: string[]): string => {
  const camino: LatLng[] = [];

  for (const codificada of codificadas) {
    const puntos = decodePolyline(codificada);
    camino.push(...(camino.length === 0 ? puntos : puntos.slice(1)));
  }

  return encodePolyline(camino);
};

/**
 * Largo acumulado de una polilinea de puntos, en metros. Sirve para las dos
 * medidas que se comparan: el camino real (vertices del trazado) y su piso
 * teorico (los paraderos unidos en recta).
 */
export const largoDelCamino = (puntos: LatLng[]): number => {
  let total = 0;
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const desde = puntos[i];
    const hasta = puntos[i + 1];
    if (desde && hasta) total += haversineMeters(desde, hasta);
  }
  return total;
};

/**
 * ¿El camino que devolvio la API es creible como recorrido de esta micro?
 *
 * Devuelve el motivo cuando NO lo es, y null cuando si. Se prefiere descartar el
 * recorrido entero antes que guardar un trazado que manda la micro a otro pueblo:
 * el principio rector vale tambien aca, y un camino inventado presentado como
 * real es peor que no tener camino.
 */
export const rodeoInverosimil = (metrosCamino: number, metrosRecta: number): string | null => {
  if (metrosRecta < RODEO_MINIMO_M) return null;

  const rodeo = metrosCamino / metrosRecta;
  if (rodeo <= RODEO_MAXIMO) return null;

  return (
    `el camino da ${rodeo.toFixed(1)}x la linea recta ` +
    `(${(metrosCamino / 1000).toFixed(1)} km contra ${(metrosRecta / 1000).toFixed(1)} km): ` +
    'probablemente no hay camino directo entre dos de sus paraderos'
  );
};
