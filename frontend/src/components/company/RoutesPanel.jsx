import { useEffect, useState } from "react"
import { Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { company } from "@/lib/api"
import { EmptyState, ErrorNotice } from "./Primitives"
import { RouteForm } from "./RouteForm"
import { SchedulesEditor } from "./SchedulesEditor"
import { StopsEditor } from "./StopsEditor"

const DAY_LABEL = { WEEKDAY: "Hábiles", SATURDAY: "Sábado", SUNDAY: "Domingo" }

export function RoutesPanel({ onAuthError }) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // { route } | { route: null } para alta
  const [stopsOf, setStopsOf] = useState(null)
  const [schedulesOf, setSchedulesOf] = useState(null)

  useEffect(() => {
    company
      .listRoutes()
      .then(setRoutes)
      .catch((err) => (err.status === 401 ? onAuthError() : setError(err.message)))
      .finally(() => setLoading(false))
  }, [onAuthError])

  const upsert = (saved) =>
    setRoutes((prev) => {
      const exists = prev.some((r) => r.id === saved.id)
      return exists ? prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r)) : [...prev, saved]
    })

  const remove = async (route) => {
    if (!confirm(`¿Eliminar el recorrido ${route.code}? Se pierden sus paraderos y horarios.`)) return
    try {
      await company.deleteRoute(route.id)
      setRoutes((prev) => prev.filter((r) => r.id !== route.id))
    } catch (err) {
      if (err.status === 401) return onAuthError()
      // 404 tambien es "ya no esta": desaparece de la lista igual.
      if (err.status === 404) setRoutes((prev) => prev.filter((r) => r.id !== route.id))
      else setError(err.message)
    }
  }

  if (loading) return <p className="text-[14px] text-[var(--ink-soft)]">Cargando recorridos…</p>

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Recorridos</h2>
        <Button
          onClick={() => setEditing({ route: null })}
          className="bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]"
        >
          <Plus /> Nuevo recorrido
        </Button>
      </div>

      <ErrorNotice>{error}</ErrorNotice>

      {routes.length === 0 ? (
        <EmptyState>Todavía no hay recorridos. Crea el primero para empezar.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {routes.map((route) => (
            <article key={route.id} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-[var(--ink)]">{route.name}</h3>
                    <Badge variant="outline">{route.code}</Badge>
                    {!route.active && <Badge variant="secondary">Inactivo</Badge>}
                  </div>
                  <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
                    {route.originName} → {route.destinationName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStopsOf(route)}>
                    <MapPin /> Paraderos ({route.stops.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSchedulesOf(route)}>
                    <Clock /> Horarios
                  </Button>
                  <Button variant="outline" size="icon-sm" aria-label="Editar" onClick={() => setEditing({ route })}>
                    <Pencil />
                  </Button>
                  <Button variant="destructive" size="icon-sm" aria-label="Eliminar" onClick={() => remove(route)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {route.stops.length > 0 && (
                <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-soft)]">
                  {route.stops.map((stop, i) => (
                    <li key={stop.id} className="flex items-center gap-2">
                      <span className={i === 0 || i === route.stops.length - 1 ? "font-medium text-[var(--ink)]" : ""}>
                        {stop.name}
                      </span>
                      {i < route.stops.length - 1 && <span aria-hidden>›</span>}
                    </li>
                  ))}
                </ol>
              )}

              {route.schedules.length > 0 && (
                <p className="mt-3 flex flex-wrap gap-3 text-[13px] text-[var(--ink-soft)]">
                  {route.schedules.map((s) => (
                    <span key={s.dayType}>
                      <strong className="font-medium text-[var(--ink)]">{DAY_LABEL[s.dayType]}:</strong>{" "}
                      {s.firstDeparture} – {s.lastDeparture}
                    </span>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {editing && (
        <RouteForm
          route={editing.route}
          onAuthError={onAuthError}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            upsert(saved)
            setEditing(null)
          }}
        />
      )}

      {stopsOf && (
        <StopsEditor
          route={stopsOf}
          onAuthError={onAuthError}
          onClose={() => setStopsOf(null)}
          onSaved={(stops) => {
            setRoutes((prev) => prev.map((r) => (r.id === stopsOf.id ? { ...r, stops } : r)))
            setStopsOf(null)
          }}
        />
      )}

      {schedulesOf && (
        <SchedulesEditor
          route={schedulesOf}
          onAuthError={onAuthError}
          onClose={() => setSchedulesOf(null)}
          onSaved={(schedules) => {
            setRoutes((prev) => prev.map((r) => (r.id === schedulesOf.id ? { ...r, schedules } : r)))
            setSchedulesOf(null)
          }}
        />
      )}
    </section>
  )
}
