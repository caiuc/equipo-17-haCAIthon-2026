import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const TONE_CLASS = {
  full: "bg-[var(--accent-soft)] text-[var(--accent-deep)]",
  ok: "bg-[#e9f7ef] text-[#12784a]",
  // Reportes que todavia no alcanzan el umbral: no es un veredicto, y no puede
  // pintarse como si lo fuera.
  pending: "bg-[var(--mist)] text-[var(--ink-soft)]",
}

/**
 * Estado de ocupacion y el voto del pasajero.
 *
 * Los dos botones muestran cual voto ESTE dispositivo. Sin eso, tocar "va llena"
 * no dejaba ninguna huella en la pantalla y el veredicto agregado podia seguir
 * diciendo otra cosa — que es como se sentia el bug: como si el toque no hubiera
 * llegado. El voto se corrige tocando la otra opcion; el backend hace upsert por
 * dispositivo, asi que el voto viejo deja de contar en vez de sumarse.
 *
 * @param {{label: string, detail: string, tone: string}|null} occupancy ya formateada
 * @param {boolean|null} myVote  lo que voto este dispositivo, o null
 */
export function OccupancyVote({ occupancy, tripId, myVote = null, onReportOccupancy }) {
  const [sending, setSending] = useState(false)

  async function report(full) {
    if (sending) return
    setSending(true)
    try {
      await onReportOccupancy?.(tripId, full)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {occupancy ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            className={`rounded-full px-2 py-0 text-[11px] font-medium ${TONE_CLASS[occupancy.tone] ?? TONE_CLASS.pending}`}
          >
            {occupancy.label}
          </Badge>
          <span className="text-[12px] text-[var(--ink-soft)]">{occupancy.detail}</span>
        </div>
      ) : (
        <span className="text-[12px] text-[var(--ink-soft)]">Nadie ha reportado si va llena</span>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => report(true)}
          disabled={sending}
          aria-pressed={myVote === true}
          className={`h-10 flex-1 rounded-xl text-[13px] ${
            myVote === true ? "border-[var(--ink)] bg-[var(--ink)] text-white" : ""
          }`}
        >
          Va llena
        </Button>
        <Button
          variant="outline"
          onClick={() => report(false)}
          disabled={sending}
          aria-pressed={myVote === false}
          className={`h-10 flex-1 rounded-xl text-[13px] ${
            myVote === false ? "border-[var(--ink)] bg-[var(--ink)] text-white" : ""
          }`}
        >
          Ya no va llena
        </Button>
      </div>

      {myVote != null && (
        <p className="text-[11px] text-[var(--ink-soft)]">
          Tu reporte: {myVote ? "va llena" : "ya no va llena"} — toca la otra opción para
          corregirlo.
        </p>
      )}
    </div>
  )
}
