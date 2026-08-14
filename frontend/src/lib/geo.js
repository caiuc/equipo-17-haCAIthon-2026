/**
 * Geometria del lado del pasajero.
 *
 * Es la misma formula, con el mismo radio y el mismo redondeo, que
 * `haversineMeters` en apps/api/src/lib/geo.ts. Se repite y no se importa porque
 * esa vive en el paquete del backend y no en el contrato compartido; si algun
 * dia se muda a `@equipo17/shared`, este archivo desaparece. Mientras tanto la
 * regla es la de siempre: si las dos divergen, la interfaz miente — la distancia
 * al paradero que calcula el servidor y la que calcula el telefono tienen que
 * dar el mismo numero.
 */

const EARTH_RADIUS_M = 6_371_000

const toRadians = (degrees) => (degrees * Math.PI) / 180

/** Distancia en linea recta entre dos puntos, en metros. */
export function haversineMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)))
}

/**
 * Paradero mas cercano a un punto. Devuelve null sin paraderos o sin ubicacion:
 * proponer "el mas cercano" sin saber donde esta la persona seria inventarlo.
 */
export function nearestStop(point, stops) {
  if (!point || !stops?.length) return null

  let best = null
  for (const stop of stops) {
    const distanceMeters = haversineMeters(point, { lat: stop.lat, lng: stop.lng })
    if (!best || distanceMeters < best.distanceMeters) best = { stop, distanceMeters }
  }
  return best
}
