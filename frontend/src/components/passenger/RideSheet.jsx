import { useRef, useState } from "react"
import { ChevronUp } from "lucide-react"
import { MicroCard } from "@/components/passenger/MicroCard"

const DRAG_THRESHOLD_PX = 40

export function RideSheet({ micros, selectedId, onSelect }) {
  const [collapsed, setCollapsed] = useState(false)
  const dragStartY = useRef(null)

  const enRuta = micros.filter((m) => m.turnoActivo)
  const fueraDeServicio = micros.filter((m) => !m.turnoActivo)

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
        collapsed ? "max-h-[110px] overflow-hidden" : "max-h-[65vh]"
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
            {enRuta.length > 0 ? `${enRuta.length} micros en ruta` : "Sin micros en ruta"}
          </span>
        )}
      </button>

      <div className="px-4 pb-6">
        <h2 className="px-1 pb-3 text-[17px] font-semibold text-[var(--ink)]">
          {enRuta.length > 0 ? "Micros en ruta" : "Sin micros en ruta ahora"}
        </h2>

        {enRuta.length === 0 && (
          <p className="px-1 pb-4 text-[13px] text-[var(--ink-soft)]">
            Ninguna micro está transmitiendo en este recorrido en este momento.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {enRuta.map((micro) => (
            <MicroCard key={micro.id} micro={micro} selected={micro.id === selectedId} onSelect={onSelect} />
          ))}
        </div>

        {fueraDeServicio.length > 0 && (
          <>
            <p className="px-1 pt-5 pb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--ink-soft)]">
              Fuera de servicio
            </p>
            <div className="flex flex-col gap-1.5">
              {fueraDeServicio.map((micro) => (
                <MicroCard key={micro.id} micro={micro} selected={false} onSelect={onSelect} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
