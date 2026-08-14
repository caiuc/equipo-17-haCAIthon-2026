/**
 * Numeros que el backend y el frontend DEBEN compartir.
 * Si divergen, la interfaz miente sobre que tan viejo es un dato, y eso es
 * exactamente lo que el principio rector del proyecto prohibe.
 */

/** Posicion mas nueva que esto: "En vivo". */
export const FRESHNESS_LIVE_MS = 30_000;

/** Entre LIVE y esto: "Senal intermitente". Mas viejo: "Sin senal". */
export const FRESHNESS_INTERMITTENT_MS = 120_000;

/** Cada cuanto el dispositivo del chofer envia su posicion. */
export const DRIVER_PING_INTERVAL_MS = 4_000;

/** Cada cuanto la vista del pasajero vuelve a consultar el estado en vivo. */
export const LIVE_POLL_INTERVAL_MS = 5_000;

/** Cada cuanto se baja una posicion desde memoria a Postgres. */
export const POSITION_SAMPLE_INTERVAL_MS = 15_000;

/** Votos netos de pasajeros necesarios para marcar una micro como llena. */
export const OCCUPANCY_FULL_THRESHOLD = 3;

/** Ventana de validez de un reporte de ocupacion. */
export const OCCUPANCY_WINDOW_MS = 15 * 60_000;

/** Velocidad maxima plausible de una micro rural, en km/h. Filtra saltos de GPS. */
export const MAX_PLAUSIBLE_SPEED_KMH = 120;
