const THRESHOLDS_SEC = {
  enVivo: 30,
  intermitente: 5 * 60,
  sinSenal: 15 * 60,
}

export const FRESHNESS = {
  EN_VIVO: "en-vivo",
  INTERMITENTE: "intermitente",
  SIN_SENAL: "sin-senal",
  FUERA_DE_SERVICIO: "fuera-de-servicio",
}

const STYLES = {
  [FRESHNESS.EN_VIVO]: { label: "En vivo", color: "#1fae5f", dotClass: "bg-[#1fae5f]" },
  [FRESHNESS.INTERMITENTE]: { label: "Señal intermitente", color: "#e0a300", dotClass: "bg-[#e0a300]" },
  [FRESHNESS.SIN_SENAL]: { label: "Sin señal", color: "#e0430f", dotClass: "bg-[#e0430f]" },
  [FRESHNESS.FUERA_DE_SERVICIO]: { label: "Fuera de servicio", color: "#8a8a92", dotClass: "bg-[#8a8a92]" },
}

/**
 * Calcula el estado de frescura (§4.5 del doc de requerimientos) a partir del
 * último timestamp de posición reportado y si el turno del chofer sigue activo.
 */
export function getFreshness(lastSeenAt, turnoActivo) {
  if (!turnoActivo) {
    return { status: FRESHNESS.FUERA_DE_SERVICIO, message: "No hay micros en ruta ahora", ...STYLES[FRESHNESS.FUERA_DE_SERVICIO] }
  }

  const diffSec = Math.max(0, (Date.now() - lastSeenAt) / 1000)
  const minutes = Math.floor(diffSec / 60)

  if (diffSec < THRESHOLDS_SEC.enVivo) {
    return { status: FRESHNESS.EN_VIVO, message: `Actualizado hace ${Math.round(diffSec)} seg`, ...STYLES[FRESHNESS.EN_VIVO] }
  }

  if (diffSec < THRESHOLDS_SEC.intermitente) {
    return {
      status: FRESHNESS.INTERMITENTE,
      message: `Última señal hace ${minutes} min — puede haber avanzado`,
      ...STYLES[FRESHNESS.INTERMITENTE],
    }
  }

  const displayMinutes = diffSec < THRESHOLDS_SEC.sinSenal ? minutes : Math.max(minutes, 15)
  return {
    status: FRESHNESS.SIN_SENAL,
    message: `Sin señal hace ${displayMinutes} min — posición no confiable`,
    ...STYLES[FRESHNESS.SIN_SENAL],
  }
}
