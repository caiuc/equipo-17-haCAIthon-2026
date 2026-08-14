/**
 * Codec del "encoded polyline" de Google.
 *
 * Es el formato en el que la Routes API devuelve el trazado y el unico que
 * `google.maps.geometry.encoding.decodePath()` entiende sin conversion, asi que
 * es tambien el que se guarda en `Route.pathPolyline`: el backend no reinterpreta
 * nada, solo lo pasa.
 *
 * Se implementa aca en vez de traer una dependencia porque son cuarenta lineas y
 * el algoritmo esta congelado desde 2005. La precision es fija: cinco decimales,
 * o sea ~1 m en el ecuador, de sobra para dibujar un camino.
 *
 * `encode` existe por dos usos concretos, ambos del simulador y del script de
 * trazados: concatenar los tramos de un recorrido de 61 paraderos (la Routes API
 * acepta 25 intermedios por peticion) y dar vuelta el trazado cuando la empresa
 * no publico el sentido contrario.
 */
import type { LatLng } from '@equipo17/shared';

const PRECISION = 1e5;

/**
 * Un valor firmado del formato: se desplaza un bit a la izquierda, los negativos
 * se invierten, y sale en grupos de 5 bits con el bit 6 encendido mientras
 * queden mas grupos. El +63 lleva cada grupo a ASCII imprimible.
 */
const codificarValor = (valor: number): string => {
  let restante = valor < 0 ? ~(valor << 1) : valor << 1;
  let salida = '';

  while (restante >= 0x20) {
    salida += String.fromCharCode((0x20 | (restante & 0x1f)) + 63);
    restante >>= 5;
  }

  return salida + String.fromCharCode(restante + 63);
};

export const encodePolyline = (puntos: LatLng[]): string => {
  let latPrevia = 0;
  let lngPrevia = 0;
  let salida = '';

  for (const punto of puntos) {
    // Se codifica el DELTA contra el punto anterior, que es lo que hace compacto
    // al formato: dos vertices contiguos de un camino difieren en pocos metros.
    const lat = Math.round(punto.lat * PRECISION);
    const lng = Math.round(punto.lng * PRECISION);
    salida += codificarValor(lat - latPrevia) + codificarValor(lng - lngPrevia);
    latPrevia = lat;
    lngPrevia = lng;
  }

  return salida;
};

/**
 * Decodifica, o devuelve [] si la cadena esta cortada o no es una polilinea.
 *
 * No lanza: el llamador ya tiene un camino de respaldo (interpolar entre
 * paraderos) y una excepcion aca solo convertiria un dato de conveniencia
 * corrupto en una micro que no sale al mapa.
 */
export const decodePolyline = (encoded: string): LatLng[] => {
  const puntos: LatLng[] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;

  /** Lee un valor firmado, o null si la cadena se acaba a mitad de grupo. */
  const leerValor = (): number | null => {
    let resultado = 0;
    let desplazamiento = 0;
    let grupo = 0;

    do {
      if (indice >= encoded.length) return null;
      grupo = encoded.charCodeAt(indice) - 63;
      indice += 1;
      if (grupo < 0) return null;
      resultado |= (grupo & 0x1f) << desplazamiento;
      desplazamiento += 5;
      // 32 bits: mas grupos que esto ya no es una polilinea, es basura.
      if (desplazamiento > 30) return null;
    } while (grupo >= 0x20);

    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };

  while (indice < encoded.length) {
    const deltaLat = leerValor();
    if (deltaLat === null) return puntos;
    const deltaLng = leerValor();
    if (deltaLng === null) return puntos;

    lat += deltaLat;
    lng += deltaLng;
    puntos.push({ lat: lat / PRECISION, lng: lng / PRECISION });
  }

  return puntos;
};
