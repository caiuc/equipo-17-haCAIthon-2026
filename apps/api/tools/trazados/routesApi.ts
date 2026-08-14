/**
 * Cliente de la Routes API de Google, acotado a lo unico que este script pide:
 * el camino en auto que pasa por una lista de puntos, en orden.
 *
 * Se habla HTTP a mano y no por el SDK de Google por lo mismo de siempre en este
 * repo: son treinta lineas contra una dependencia con su propia cadena de
 * autenticacion, y esto corre una vez cada varios meses.
 */
import type { LatLng } from '@equipo17/shared';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/**
 * Solo estos tres campos. El FieldMask es obligatorio en la Routes API y ademas
 * es lo que define el precio: pedir `routes.legs.*` sube al tier caro sin que
 * nadie lo note hasta la factura.
 */
const CAMPOS = 'routes.distanceMeters,routes.polyline.encodedPolyline';

export type Trazo = {
  encodedPolyline: string;
  distanceMeters: number;
};

export class RoutesApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RoutesApiError';
  }
}

const comoLatLng = (punto: LatLng) => ({
  location: { latLng: { latitude: punto.lat, longitude: punto.lng } },
});

type Respuesta = {
  routes?: { distanceMeters?: number; polyline?: { encodedPolyline?: string } }[];
  error?: { message?: string; status?: string };
};

/**
 * Pide el camino que une `puntos` en orden. Devuelve null cuando Google contesta
 * bien pero sin ninguna ruta: ese es el "no hay camino manejable entre estos dos
 * paraderos", y es una respuesta, no un error.
 *
 * Los intermedios van como `via` y no como parada. Con parada, la API obliga a
 * LLEGAR a cada coordenada, y las nuestras son aproximadas (geocodificadas a la
 * localidad, no al poste): cada una a doscientos metros del camino generaba un
 * desvio de ida y vuelta para "entrar" al paradero. Como `via`, el camino solo
 * pasa por ahi, que es lo que se quiere dibujar.
 */
export const pedirTrazo = async (
  puntos: LatLng[],
  apiKey: string,
  timeoutMs = 20_000,
): Promise<Trazo | null> => {
  const origen = puntos[0];
  const destino = puntos[puntos.length - 1];
  if (!origen || !destino || puntos.length < 2) return null;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': CAMPOS,
    },
    body: JSON.stringify({
      origin: comoLatLng(origen),
      destination: comoLatLng(destino),
      intermediates: puntos.slice(1, -1).map((punto) => ({ ...comoLatLng(punto), via: true })),
      travelMode: 'DRIVE',
      // Sin trafico: el trazado es geometria, no un tiempo de viaje. Ademas
      // TRAFFIC_AWARE sube de tier de precio y daria un camino distinto segun la
      // hora a la que se corriera el script.
      routingPreference: 'TRAFFIC_UNAWARE',
      // Mas vertices por curva. No cambia el precio (se paga por peticion) y es
      // justamente lo que evita que la micro corte las curvas del camino.
      polylineQuality: 'HIGH_QUALITY',
      computeAlternativeRoutes: false,
      languageCode: 'es-CL',
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const texto = await res.text();
  const datos = texto ? (JSON.parse(texto) as Respuesta) : {};

  if (!res.ok) {
    const detalle = datos.error?.message ?? res.statusText;
    throw new RoutesApiError(res.status, `${res.status} ${detalle}`);
  }

  const ruta = datos.routes?.[0];
  const encodedPolyline = ruta?.polyline?.encodedPolyline;
  // `routes: []` con 200 es la forma en que la API dice "no encontre camino".
  if (!ruta || !encodedPolyline) return null;

  return { encodedPolyline, distanceMeters: ruta.distanceMeters ?? 0 };
};
