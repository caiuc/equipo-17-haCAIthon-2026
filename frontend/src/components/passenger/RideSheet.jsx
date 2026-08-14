import { MicroCard } from "@/components/passenger/MicroCard"

export function RideSheet({ micros, selectedId, onSelect }) {
  const enRuta = micros.filter((m) => m.turnoActivo)
  const fueraDeServicio = micros.filter((m) => !m.turnoActivo)

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 max-h-[65vh] overflow-y-auto rounded-t-3xl border-t border-[var(--line)] bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      <div className="sticky top-0 flex justify-center bg-white/95 pt-2.5 pb-1 backdrop-blur-xl">
        <div className="h-1 w-9 rounded-full bg-[var(--line)]" />
      </div>

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
