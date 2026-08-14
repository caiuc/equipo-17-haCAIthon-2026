import { useState } from "react"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorNotice } from "@/components/company/Primitives"
import { driver } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Reporte de ocupacion del chofer.
 *
 * El chofer ve el bus por dentro y los pasajeros votan desde afuera: por eso su
 * reporte vale solo y pisa al de ellos. Son dos botones y ningun formulario
 * porque se toca en un semaforo.
 */
export function OccupancyControls({ tripId, onAuthError }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const report = async (full) => {
    setBusy(full ? "FULL" : "NOT_FULL")
    setError(null)
    try {
      const data = await driver.reportOccupancy(tripId, full)
      setStatus(data.occupancy?.status ?? (full ? "FULL" : "NOT_FULL"))
    } catch (err) {
      if (err.status === 401) return onAuthError()
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const options = [
    { key: "FULL", label: "Va llena", full: true },
    { key: "NOT_FULL", label: "Va con espacio", full: false },
  ]

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <h3 className="flex items-center gap-2 text-[16px] font-semibold text-[var(--ink)]">
        <Users className="size-5 text-[var(--ink-soft)]" />
        ¿Cómo va la micro?
      </h3>
      <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
        Lo que marques manda sobre lo que reportan los pasajeros.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant="outline"
            onClick={() => report(option.full)}
            disabled={busy !== null}
            aria-pressed={status === option.key}
            className={cn(
              "h-16 rounded-2xl border-2 text-[17px] font-semibold",
              status === option.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                : "border-[var(--line)] text-[var(--ink)]"
            )}
          >
            {busy === option.key ? "Enviando…" : option.label}
          </Button>
        ))}
      </div>

      <div className="mt-3">
        <ErrorNotice>{error}</ErrorNotice>
      </div>
    </section>
  )
}
