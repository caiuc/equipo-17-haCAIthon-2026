import { useState } from "react"
import { Check, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BusSprite } from "@/components/passenger/BusSprite"
import { formatFare } from "@/lib/fare"
import { FRESHNESS, formatDistance, formatOccupancy, getFreshness } from "@/lib/freshness"

const REPORT_CONFIRMATION_MS = 2500

function OccupancyBadge({ occupancy }) {
  const shown = formatOccupancy(occupancy)

  if (!shown) {
    return (
      <span className="text-[12px] text-[var(--ink-soft)]">Nadie ha reportado si va llena</span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge
        className={`rounded-full px-2 py-0 text-[11px] font-medium ${
          shown.tone === "full"
            ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
            : "bg-[#e9f7ef] text-[#12784a]"
        }`}
      >
        {shown.label}
      </Badge>
      <span className="text-[12px] text-[var(--ink-soft)]">{shown.detail}</span>
    </div>
  )
}

/**
 * Aqui NO va un ETA en minutos. No modelamos subida de pasajeros, paradas a la
 * sena ni el trazado real del camino: un ETA sobre eso estaria malo, y un ETA
 * malo genera confianza falsa. Va la distancia en linea recta, o nada cuando el
 * backend no la entrega — que es justo cuando la posicion ya no la sostiene.
 */
function DistanceLine({ distanceMeters, unreliable }) {
  const distance = formatDistance(distanceMeters)
  if (distance) return <span className="text-[13px] text-[var(--ink)]">A {distance}</span>

  if (unreliable) {
    return (
      <span className="text-[12px] text-[var(--ink-soft)]">
        Sin distancia: la última posición es muy vieja
      </span>
    )
  }
  return <span className="text-[12px] text-[var(--ink-soft)]">Elige tu paradero para la distancia</span>
}

export function MicroCard({ bus, selected, onSelect, onReportOccupancy, elapsedMs = 0 }) {
  const [sending, setSending] = useState(false)
  const [confirmed, setConfirmed] = useState(null)

  const freshness = getFreshness(bus, elapsedMs)
  const fare = formatFare(bus.fareAdultClp)
  // Sin señal significa que la posición ya no sostiene una distancia: no se
  // estima nada, se declara la incertidumbre.
  const positionUnreliable = freshness.status === FRESHNESS.NO_SIGNAL

  async function report(full) {
    if (sending) return
    setSending(true)
    try {
      await onReportOccupancy?.(bus.tripId, full)
      setConfirmed(full ? "Reportaste que va llena" : "Reportaste que ya no va llena")
      setTimeout(() => setConfirmed(null), REPORT_CONFIRMATION_MS)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={`rounded-2xl border bg-white transition-colors ${
        selected ? "border-[var(--ink)] shadow-sm" : "border-[var(--line)]"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(bus.tripId)}
        className="flex w-full flex-col gap-2 px-3.5 py-3 text-left"
        aria-pressed={selected}
      >
        <div className="flex items-center gap-3">
          {/* En la lista el rumbo no aporta: el sprite va derecho. */}
          <BusSprite
            assetSlug={bus.company.assetSlug}
            status={freshness.status}
            statusLabel={freshness.label}
            companyColor={bus.company.color}
            size={44}
            rotate={false}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="shrink-0 text-[15px] font-semibold text-[var(--ink)]">
                {bus.routeCode}
              </span>
              <span className="truncate text-[13px] text-[var(--ink-soft)]">
                {bus.company.name}
              </span>
            </div>
            <p className="truncate text-[12px] text-[var(--ink-soft)]">{bus.routeName}</p>
            {bus.seats != null && (
              <span className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--ink-soft)]">
                <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                {bus.seats} asientos
              </span>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p
              className={
                fare.tone === "unknown"
                  ? "text-[12px] text-[var(--ink-soft)]"
                  : "text-[15px] font-semibold text-[var(--ink)]"
              }
            >
              {fare.label}
            </p>
            <DistanceLine distanceMeters={bus.distanceMeters} unreliable={positionUnreliable} />
          </div>
        </div>

        {/* Nunca un dato sin decir que tan viejo es: el chip y su texto. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--mist)] px-2 py-0.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${freshness.dotClass}`} />
            <span className="text-[12px] font-medium" style={{ color: freshness.color }}>
              {freshness.label}
            </span>
          </span>
          <span className="text-[12px] text-[var(--ink-soft)]">{freshness.message}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[12px] text-[var(--ink-soft)]">{bus.driverName}</span>
          {bus.plate && (
            <span className="text-[12px] text-[var(--ink-soft)]">· {bus.plate}</span>
          )}
        </div>

        <OccupancyBadge occupancy={bus.occupancy} />
      </button>

      <Separator className="bg-[var(--line)]" />

      <div className="flex items-center gap-2 px-3.5 py-2.5">
        {confirmed ? (
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#12784a]">
            <Check className="h-4 w-4" strokeWidth={2} />
            {confirmed}
          </p>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => report(true)}
              disabled={sending}
              className="h-10 flex-1 rounded-xl text-[13px]"
            >
              Va llena
            </Button>
            <Button
              variant="outline"
              onClick={() => report(false)}
              disabled={sending}
              className="h-10 flex-1 rounded-xl text-[13px]"
            >
              Ya no va llena
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
