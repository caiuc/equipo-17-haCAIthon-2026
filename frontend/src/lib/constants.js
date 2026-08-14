/**
 * Espejo de packages/shared/src/constants.ts.
 *
 * El frontend vive fuera del workspace de pnpm (usa yarn), asi que no puede
 * importar el paquete compartido. Si alguno de estos numeros cambia en el
 * backend, hay que cambiarlo aqui tambien.
 *
 * Los umbrales de frescura NO estan aqui a proposito: el estado lo calcula el
 * servidor y viaja en cada respuesta, justamente para que no puedan divergir.
 */

/** Cada cuanto la vista del pasajero vuelve a consultar el estado en vivo. */
export const LIVE_POLL_MS = 5_000

/** Cada cuanto transmite el dispositivo del chofer. */
export const DRIVER_PING_MS = 4_000

/** Votos netos de pasajeros que marcan una micro como llena. */
export const OCCUPANCY_FULL_THRESHOLD = 3
