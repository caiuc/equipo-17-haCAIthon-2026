/**
 * Presentacion del estado de frescura (§4.5 de los requerimientos).
 *
 * IMPORTANTE: el estado NO se calcula aqui. Lo calcula el backend en cada
 * lectura y viaja en el campo `freshness` de cada micro. Antes este archivo
 * tenia sus propios umbrales (intermitente hasta 5 min) que no coincidian con
 * los del servidor (sin senal a los 2 min): el resultado era una interfaz que
 * decia "puede haber avanzado" cuando el backend ya consideraba la posicion no
 * confiable. Un solo lugar decide, y es el servidor.
 *
 * Aqui solo se traduce ese estado a etiqueta, color y mensaje.
 */

export const FRESHNESS = {
  LIVE: "LIVE",
  INTERMITTENT: "INTERMITTENT",
  NO_SIGNAL: "NO_SIGNAL",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
}

const STYLES = {
  [FRESHNESS.LIVE]: { label: "En vivo", color: "#1fae5f", dotClass: "bg-[#1fae5f]" },
  [FRESHNESS.INTERMITTENT]: { label: "Señal intermitente", color: "#e0a300", dotClass: "bg-[#e0a300]" },
  [FRESHNESS.NO_SIGNAL]: { label: "Sin señal", color: "#e0430f", dotClass: "bg-[#e0430f]" },
  [FRESHNESS.OUT_OF_SERVICE]: { label: "Fuera de servicio", color: "#8a8a92", dotClass: "bg-[#8a8a92]" },
}

const humanAge = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)} seg`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/**
 * Traduce una micro del API a como se muestra su frescura.
 * @param {{freshness: string, ageSeconds: number}} bus  micro de GET /routes/:id/live
 */
export function getFreshness(bus) {
  const status = bus?.freshness ?? FRESHNESS.OUT_OF_SERVICE
  const style = STYLES[status] ?? STYLES[FRESHNESS.OUT_OF_SERVICE]
  const age = humanAge(bus?.ageSeconds ?? 0)

  const messages = {
    [FRESHNESS.LIVE]: `Actualizado hace ${age}`,
    [FRESHNESS.INTERMITTENT]: `Última señal hace ${age} — puede haber avanzado`,
    [FRESHNESS.NO_SIGNAL]: `Sin señal hace ${age} — posición no confiable`,
    [FRESHNESS.OUT_OF_SERVICE]: "No hay micros en ruta ahora",
  }

  return { status, message: messages[status], ...style }
}

/** Estilo del estado "sin micros", para cuando la lista viene vacia. */
export const outOfServiceStyle = () => ({
  status: FRESHNESS.OUT_OF_SERVICE,
  message: "No hay micros en ruta ahora",
  ...STYLES[FRESHNESS.OUT_OF_SERVICE],
})

/**
 * Distancia lista para mostrar. Devuelve null cuando el backend no la entrega,
 * que es exactamente cuando la posicion es demasiado vieja para sostenerla:
 * en ese caso NO se estima nada por cuenta propia.
 */
export function formatDistance(distanceMeters) {
  if (distanceMeters == null) return null
  if (distanceMeters < 1000) return `${distanceMeters} m`
  return `${(distanceMeters / 1000).toFixed(1)} km`
}

/** Como se muestra el estado de ocupacion que resuelve el backend. */
export function formatOccupancy(occupancy) {
  if (!occupancy || occupancy.status === "UNKNOWN") return null

  const porElChofer = occupancy.source === "DRIVER"
  if (occupancy.status === "FULL") {
    return {
      label: "Va llena",
      detail: porElChofer ? "Segun el chofer" : `${occupancy.reportCount} pasajeros lo reportaron`,
      tone: "full",
    }
  }

  return {
    label: "Va con espacio",
    detail: porElChofer ? "Segun el chofer" : "Segun los pasajeros",
    tone: "ok",
  }
}
