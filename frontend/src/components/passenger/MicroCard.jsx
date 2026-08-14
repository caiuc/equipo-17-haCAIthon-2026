import { useState } from "react"
import { Check, MapPin, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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

export function MicroCard({ bus, selected, onSelect, onReportOccupancy }) {
  const [sending, setSending] = useState(false)
  const [confirmed, setConfirmed] = useState(null)

  const freshness = getFreshness(bus)
  const distance = formatDistance(bus.distanceMeters)
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
        {/* Lo primero y más visible: qué tan vieja es esta información. */}
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${freshness.dotClass}`} />
          <span className="text-[13px] font-semibold" style={{ color: freshness.color }}>
            {freshness.label}
          </span>
        </div>
        <p className="text-[12px] leading-snug text-[var(--ink-soft)]">{freshness.message}</p>

        <div className="flex items-start gap-2">
          <MapPin
            className={`mt-0.5 h-4 w-4 shrink-0 ${positionUnreliable ? "text-[var(--ink-soft)]" : "text-[var(--ink)]"}`}
            strokeWidth={1.75}
          />
          {distance ? (
            <p className="text-[18px] font-semibold leading-tight text-[var(--ink)]">
              A {distance} del paradero
            </p>
          ) : (
            <p className="text-[13px] leading-snug text-[var(--ink-soft)]">
              {positionUnreliable
                ? "No mostramos distancia: la última posición es demasiado vieja para confiar en ella."
                : "Elige un paradero para ver a qué distancia va."}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-[var(--ink-soft)]" strokeWidth={1.75} />
          <p className="truncate text-[13px] text-[var(--ink)]">{bus.driverName}</p>
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
