import { useRef, useState } from "react"
import { BusFront, ChevronUp } from "lucide-react"
import { MicroCard } from "@/components/passenger/MicroCard"
import { outOfServiceStyle } from "@/lib/freshness"

const DRAG_THRESHOLD_PX = 40

function StopPicker({ stops, selectedStopId, onSelectStop }) {
  if (!stops.length) return null

  const ordered = [...stops].sort((a, b) => a.stopOrder - b.stopOrder)

  return (
    <div className="pb-3">
      <p className="px-1 pb-1.5 text-[12px] text-[var(--ink-soft)]">
        {selectedStopId ? "Distancias medidas a este paradero" : "Elige tu paradero para ver distancias"}
      </p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {ordered.map((stop) => {
          const isSelected = stop.id === selectedStopId

          return (
            <button
              key={stop.id}
              type="button"
              onClick={() => onSelectStop?.(isSelected ? null : stop.id)}
              aria-pressed={isSelected}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors ${
                isSelected
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)]"
              }`}
            >
              {stop.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OutOfServiceState() {
  const style = outOfServiceStyle()

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--mist)] px-5 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
        <BusFront className="h-6 w-6 text-[var(--ink-soft)]" strokeWidth={1.5} />
      </div>
      <p className="text-[17px] font-semibold" style={{ color: style.color }}>
        {style.message}
      </p>
      <p className="max-w-[34ch] text-[13px] leading-snug text-[var(--ink-soft)]">
        Ninguna micro está transmitiendo en este recorrido. No es que no sepamos dónde van: es que
        no hay ninguna en ruta ahora.
      </p>
    </div>
  )
}

export function RideSheet({
  buses = [],
  route,
  stops = [],
  selectedStopId,
  onSelectStop,
  selectedBusId,
  onSelectBus,
  onReportOccupancy,
  outOfService,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const dragStartY = useRef(null)

  const sinMicros = outOfService || buses.length === 0

  function handleDragStart(e) {
    dragStartY.current = e.clientY ?? e.touches?.[0]?.clientY ?? null
  }

  function handleDragEnd(e) {
    if (dragStartY.current == null) return
    const endY = e.clientY ?? e.changedTouches?.[0]?.clientY ?? dragStartY.current
    const delta = endY - dragStartY.current
    dragStartY.current = null

    if (delta > DRAG_THRESHOLD_PX) setCollapsed(true)
    else if (delta < -DRAG_THRESHOLD_PX) setCollapsed(false)
  }

  return (
    <div
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-10 overflow-y-auto rounded-t-3xl border-t border-[var(--line)] bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] transition-[max-height] duration-300 ease-out ${
        collapsed ? "max-h-[110px] overflow-hidden" : "max-h-[70vh]"
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        onPointerDown={handleDragStart}
        onPointerUp={handleDragEnd}
        className="sticky top-0 z-10 flex w-full flex-col items-center gap-1.5 bg-white/95 pt-2.5 pb-1.5 backdrop-blur-xl touch-none"
        aria-label={collapsed ? "Mostrar lista de micros" : "Ver mapa completo"}
      >
        <div className="h-1 w-9 rounded-full bg-[var(--line)]" />
        {collapsed && (
          <span className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)]">
            <ChevronUp className="h-3 w-3" />
            {sinMicros
              ? "No hay micros en ruta ahora"
              : `${buses.length} ${buses.length === 1 ? "micro en ruta" : "micros en ruta"}`}
          </span>
        )}
      </button>

      <div className="px-4 pb-6">
        {route && (
          <div className="px-1 pb-3">
            <h2 className="text-[17px] font-semibold leading-tight text-[var(--ink)]">
              {route.name}
            </h2>
            <p className="text-[13px] text-[var(--ink-soft)]">
              {route.code ? `${route.code} · ` : ""}
              {route.originName} ↔ {route.destinationName}
            </p>
          </div>
        )}

        <StopPicker stops={stops} selectedStopId={selectedStopId} onSelectStop={onSelectStop} />

        {sinMicros ? (
          <OutOfServiceState />
        ) : (
          <div className="flex flex-col gap-2">
            {buses.map((bus) => (
              <MicroCard
                key={bus.tripId}
                bus={bus}
                selected={bus.tripId === selectedBusId}
                onSelect={onSelectBus}
                onReportOccupancy={onReportOccupancy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
