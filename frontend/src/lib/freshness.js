/**
 * Presentacion del estado de frescura (§4.5 de los requerimientos).
 *
 * IMPORTANTE: el estado lo decide el backend en cada lectura y viaja en
 * `freshness` / `ageSeconds`. Aqui solo se traduce a etiqueta, texto y
 * tratamiento visual del sprite, y se deja envejecer el dato entre consultas.
 *
 * Los umbrales NO se escriben a mano: se importan del contrato compartido, con
 * el mismo `<=` que usa freshnessOf() en apps/api/src/services/liveStore.ts. Si
 * el front y el servidor divergen, la interfaz miente sobre que tan viejo es un
 * dato, que es justo lo que el principio rector prohibe.
 */

import {
  FRESHNESS_INTERMITTENT_MS,
  FRESHNESS_LIVE_MS,
  OCCUPANCY_FULL_THRESHOLD,
} from "@equipo17/shared"

export const FRESHNESS = {
  LIVE: "LIVE",
  INTERMITTENT: "INTERMITTENT",
  NO_SIGNAL: "NO_SIGNAL",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
}

/**
 * El color ya significa "empresa" en este mapa, asi que la frescura NO se
 * expresa con color sobre el sprite: se expresa con saturacion del dibujo,
 * con un punto que late junto a la etiqueta y con la etiqueta misma. Nunca solo
 * con color — cada estado lleva ademas su texto.
 *
 * `animated` es tambien la regla de la animacion: solo LIVE se mueve. Una micro
 * sin senal deslizandose por el mapa seria una mentira en movimiento.
 */
const STYLES = {
  [FRESHNESS.LIVE]: {
    label: "En vivo",
    color: "#1fae5f",
    dotClass: "bg-[#1fae5f]",
    sprite: { filter: "none", animated: true, zIndex: 30 },
  },
  [FRESHNESS.INTERMITTENT]: {
    label: "Señal intermitente",
    color: "#e0a300",
    dotClass: "bg-[#e0a300]",
    sprite: { filter: "saturate(0.55)", animated: false, zIndex: 20 },
  },
  [FRESHNESS.NO_SIGNAL]: {
    label: "Sin señal",
    color: "#e0430f",
    dotClass: "bg-[#e0430f]",
    sprite: { filter: "grayscale(1) opacity(0.55)", animated: false, zIndex: 1 },
  },
  [FRESHNESS.OUT_OF_SERVICE]: {
    label: "Fuera de servicio",
    color: "#8a8a92",
    dotClass: "bg-[#8a8a92]",
    sprite: { filter: "grayscale(1) opacity(0.55)", animated: false, zIndex: 1 },
  },
}

// Severidad para que el recalculo local solo pueda EMPEORAR el estado que
// declaro el servidor. Nunca mejorarlo: el servidor es el que manda.
const SEVERITY = {
  [FRESHNESS.LIVE]: 0,
  [FRESHNESS.INTERMITTENT]: 1,
  [FRESHNESS.NO_SIGNAL]: 2,
  [FRESHNESS.OUT_OF_SERVICE]: 3,
}

/** Mismos umbrales y mismo `<=` que el backend. */
export function freshnessFromAge(ageMs) {
  if (ageMs <= FRESHNESS_LIVE_MS) return FRESHNESS.LIVE
  if (ageMs <= FRESHNESS_INTERMITTENT_MS) return FRESHNESS.INTERMITTENT
  return FRESHNESS.NO_SIGNAL
}

const humanAge = (seconds) => {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total} seg`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/**
 * Traduce una micro del API a como se muestra su frescura.
 *
 * @param {{freshness: string, ageSeconds: number}} bus  micro de /live
 * @param {number} elapsedMs  milisegundos transcurridos desde que llego la
 *   respuesta, medidos con un reloj monotono del navegador. Sirve para envejecer
 *   el dato entre consultas (si el polling se corta, la micro se degrada sola en
 *   pantalla). Nunca se compara el reloj del telefono contra `serverTime`: los
 *   celulares rurales andan desfasados y eso inventaria edades.
 */
export function getFreshness(bus, elapsedMs = 0) {
  const declared = bus?.freshness ?? FRESHNESS.OUT_OF_SERVICE
  const ageSeconds = Math.max(0, bus?.ageSeconds ?? 0) + Math.max(0, elapsedMs) / 1000
  const recomputed = freshnessFromAge(ageSeconds * 1000)
  const status = SEVERITY[recomputed] > SEVERITY[declared] ? recomputed : declared
  const style = STYLES[status] ?? STYLES[FRESHNESS.OUT_OF_SERVICE]
  const age = humanAge(ageSeconds)

  const messages = {
    [FRESHNESS.LIVE]: `Actualizado hace ${age}`,
    [FRESHNESS.INTERMITTENT]: `Última señal hace ${age} — puede haber avanzado`,
    [FRESHNESS.NO_SIGNAL]: `Sin señal hace ${age} — posición no confiable`,
    [FRESHNESS.OUT_OF_SERVICE]: "No hay micros en ruta ahora",
  }

  return { status, ageSeconds, message: messages[status], ...style }
}

/** Estilo del estado "sin micros", para cuando la lista viene vacia. */
export const outOfServiceStyle = () => ({
  status: FRESHNESS.OUT_OF_SERVICE,
  message: "No hay micros en ruta ahora",
  ...STYLES[FRESHNESS.OUT_OF_SERVICE],
})

/** Tratamiento del sprite para un estado dado. */
export const spriteTreatment = (status) =>
  (STYLES[status] ?? STYLES[FRESHNESS.OUT_OF_SERVICE]).sprite

/**
 * Etiqueta, color y punto de un estado, sin calcular edad. Lo usa el sprite del
 * mapa, que recibe el estado ya resuelto y solo necesita como pintarlo.
 */
export const freshnessStyle = (status) => STYLES[status] ?? STYLES[FRESHNESS.OUT_OF_SERVICE]

/**
 * Distancia lista para mostrar. Devuelve null cuando el backend no la entrega,
 * que es exactamente cuando la posicion es demasiado vieja para sostenerla:
 * en ese caso NO se estima nada por cuenta propia.
 */
export function formatDistance(distanceMeters) {
  if (distanceMeters == null) return null
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`
  // Coma decimal: "2,3 km" es como se lee un numero en Chile.
  const km = (distanceMeters / 1000).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${km} km`
}

/**
 * Como se muestra el estado de ocupacion que resuelve el backend.
 *
 * Son CUATRO casos, no dos. El bug que esto arregla nacia de colapsarlos: con un
 * solo voto de pasajero el backend responde `NOT_FULL` (hacen falta
 * OCCUPANCY_FULL_THRESHOLD votos netos para marcarla llena) y la tarjeta decia
 * "Va con espacio" — o sea, le contestaba lo contrario a la persona que acababa
 * de reportar que iba llena.
 *
 * El umbral no era el problema; el problema era que la interfaz nunca contaba
 * que existia. Ahora se dice: "1 de 3 reportes para marcarla llena". Es la misma
 * regla de siempre — declarar en que estado esta el dato en vez de presentar una
 * conclusion que no se sostiene.
 *
 * "Va con espacio" queda reservado para cuando es un hecho: lo dijo el chofer, o
 * hay al menos tantos reportes como el umbral y aun asi el veredicto no es FULL,
 * lo que solo puede ocurrir si hay votos de "ya no va llena" restando.
 */
export function formatOccupancy(occupancy) {
  if (!occupancy || occupancy.status === "UNKNOWN") return null

  // El chofer ve el bus; los pasajeros votan desde afuera. Su veredicto vale
  // solo y no se acompana de ningun conteo.
  if (occupancy.source === "DRIVER") {
    return occupancy.status === "FULL"
      ? { label: "Va llena", detail: "Según el chofer", tone: "full" }
      : { label: "Va con espacio", detail: "Según el chofer", tone: "ok" }
  }

  if (occupancy.status === "FULL") {
    return {
      label: "Va llena",
      detail: `${occupancy.reportCount} ${occupancy.reportCount === 1 ? "pasajero lo reportó" : "pasajeros lo reportaron"}`,
      tone: "full",
    }
  }

  if (occupancy.reportCount < OCCUPANCY_FULL_THRESHOLD) {
    return {
      label: "Sin veredicto todavía",
      detail: `${occupancy.reportCount} de ${OCCUPANCY_FULL_THRESHOLD} reportes para marcarla llena`,
      tone: "pending",
    }
  }

  return {
    label: "Va con espacio",
    detail: "Según los pasajeros",
    tone: "ok",
  }
}
