import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorNotice } from "@/components/company/Primitives"
import { cn } from "@/lib/utils"

/**
 * Eleccion del recorrido antes de iniciar turno.
 *
 * Un `select` nativo seria mas corto de escribir, pero se opera con el dedo en
 * movimiento: aca cada recorrido es una fila de 72 px que se toca sin apuntar,
 * y no hay ningun menu que se despliegue encima de otro.
 */
export function RoutePicker({ routes, onStart }) {
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const start = async () => {
    if (!selectedId) return
    setBusy(true)
    setError(null)
    try {
      await onStart(selectedId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (routes?.length === 0) {
    return (
      <EmptyState>
        Tu empresa todavía no tiene recorridos activos cargados. Pídele al administrador que los cree
        en el panel de empresa.
      </EmptyState>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          ¿Qué recorrido vas a hacer?
        </h2>
        <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
          Cada sentido es un recorrido distinto. Elige el que vas a hacer ahora.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {routes?.map((route) => {
          const selected = route.id === selectedId
          return (
            <li key={route.id}>
              <button
                type="button"
                onClick={() => setSelectedId(route.id)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] hover:border-[var(--ink-soft)]"
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[17px] font-semibold text-[var(--ink)]">
                    {route.code} · {route.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[15px] text-[var(--ink-soft)]">
                    {route.originName} → {route.destinationName}
                  </span>
                </span>
                {selected && <Check className="size-6 shrink-0 text-[var(--accent-deep)]" />}
              </button>
            </li>
          )
        })}
      </ul>

      <ErrorNotice>{error}</ErrorNotice>

      <Button
        type="button"
        onClick={start}
        disabled={!selectedId || busy}
        className="h-16 w-full rounded-2xl bg-[var(--accent)] text-[18px] font-semibold text-white hover:bg-[var(--accent-deep)]"
      >
        {busy ? "Iniciando…" : "Iniciar turno"}
      </Button>

      <p className="text-center text-[14px] text-[var(--ink-soft)]">
        Al iniciar, tu micro aparece en el mapa de los pasajeros.
      </p>
    </section>
  )
}
