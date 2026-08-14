import type { LatLng } from '@equipo17/shared';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Distancia en linea recta entre dos puntos, en metros.
 *
 * Deliberadamente NO se suma la distancia a lo largo de los paraderos: no
 * conocemos el trazado real de estos recorridos rurales, y encadenar tramos
 * entre paraderos aproximados acumularia un error que no sabriamos acotar.
 * La linea recta subestima, pero de forma predecible y explicable.
 */
export const haversineMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
};
