import { useEffect, useState } from "react"
import { Bus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { LIVE_POLL_INTERVAL_MS } from "@equipo17/shared"
import { getFreshness } from "@/lib/freshness"
import { EmptyState, ErrorNotice } from "./Primitives"

const hora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "—"

export function FleetPanel({ onAuthError }) {
  const [trips, setTrips] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const data = await company.liveTrips()
        if (cancelled) return
        setTrips(data.trips)
        setError(null)
      } catch (err) {
        if (cancelled) return
        if (err.status === 401) return onAuthError()
        setError(err.message)
      }
    }

    poll()
    const id = setInterval(poll, LIVE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [onAuthError])

  if (trips === null && !error) {
    return <p className="text-[14px] text-[var(--ink-soft)]">Cargando flota…</p>
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Flota en ruta</h2>
        <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
          Turnos en curso ahora. Se actualiza solo cada {LIVE_POLL_INTERVAL_MS / 1000} segundos.
        </p>
      </div>

      <ErrorNotice>{error}</ErrorNotice>

      {trips?.length === 0 ? (
        <EmptyState>Ninguna micro tiene turno iniciado en este momento.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {trips?.map((trip) => {
            const freshness = getFreshness(trip)
            return (
              <article key={trip.tripId} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--ink)]">{trip.driverName}</h3>
                    <p className="text-[13px] text-[var(--ink-soft)]">{trip.routeName}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px]" style={{ color: freshness.color }}>
                    <span className={`size-2 rounded-full ${freshness.dotClass}`} />
                    {freshness.label}
                  </span>
                </div>

                <p className="mt-3 text-[13px] text-[var(--ink-soft)]">{freshness.message}</p>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                  <div>
                    <dt className="text-[var(--ink-soft)]">Turno iniciado</dt>
                    <dd className="text-[var(--ink)]">{hora(trip.startedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-soft)]">Posición</dt>
                    <dd className="text-[var(--ink)]">
                      {trip.position
                        ? `${trip.position.lat.toFixed(4)}, ${trip.position.lng.toFixed(4)}`
                        : "Sin señal todavía"}
                    </dd>
                  </div>
                </dl>

                {/* Un turno sin posicion se muestra igual: ocultarlo haria creer que la micro no salio. */}
                {!trip.position && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--mist)] px-3 py-2 text-[12px] text-[var(--ink-soft)]">
                    <Bus className="size-3.5 shrink-0" />
                    El turno está iniciado, pero el teléfono del chofer aún no transmite.
                  </p>
                )}

                {trip.position && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    render={
                      <a
                        href={`https://www.google.com/maps?q=${trip.position.lat},${trip.position.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    Ver en el mapa
                  </Button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
