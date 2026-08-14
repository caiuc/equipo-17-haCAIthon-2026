import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, Loader2, Search, X } from "lucide-react"
import { MapView } from "@/components/passenger/MapView"
import { RideSheet } from "@/components/passenger/RideSheet"
import { useLiveRoute } from "@/hooks/useLiveRoute"
import { useRouteSearch } from "@/hooks/useRouteSearch"
import { getRoute, reportOccupancy } from "@/lib/api"

export default function PassengerApp() {
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(true)
  const [route, setRoute] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [selectedStopId, setSelectedStopId] = useState(null)
  const [selectedBusId, setSelectedBusId] = useState(null)
  const [reportError, setReportError] = useState(null)

  const { routes, loading: searching, error: searchError } = useRouteSearch(query)
  const { live, loading: liveLoading, error: liveError, refresh } = useLiveRoute(route?.id ?? null, selectedStopId)

  const stops = route?.stops ?? []
  const buses = live?.buses ?? []

  async function selectRoute(routeId) {
    setSearchOpen(false)
    setRouteLoading(true)
    setRouteError(null)
    setSelectedBusId(null)
    try {
      const detail = await getRoute(routeId)
      setRoute(detail)
      // Sin paradero el backend devuelve distanceMeters null, asi que se parte
      // por el origen y el pasajero corrige al suyo desde el selector.
      setSelectedStopId(detail.stops?.[0]?.id ?? null)
    } catch (err) {
      setRoute(null)
      setSelectedStopId(null)
      setRouteError(err)
    } finally {
      setRouteLoading(false)
    }
  }

  async function handleReportOccupancy(tripId, full) {
    setReportError(null)
    try {
      await reportOccupancy(tripId, full)
    } catch (err) {
      setReportError(err)
    }
    // Se refresca igual: si el reporte entro, la ocupacion que muestra el
    // servidor es la unica version que vale.
    refresh()
  }

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[var(--mist)]">
      <MapView buses={buses} stops={stops} selectedBusId={selectedBusId} onSelectBus={setSelectedBusId} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
          >
            <ChevronLeft className="h-5 w-5 text-[var(--ink)]" />
          </Link>
          <div className="pointer-events-auto flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-md">
            <Search className="h-4 w-4 shrink-0 text-[var(--ink-soft)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder={route ? route.name : "Buscar recorrido o número"}
              aria-label="Buscar recorrido"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
            />
            {(query || searchOpen) && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setSearchOpen(false)
                }}
                aria-label="Cerrar búsqueda"
                className="shrink-0 text-[var(--ink-soft)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {searchOpen && (
          <div className="pointer-events-auto ml-12 max-h-[55vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white shadow-lg">
            {searching && (
              <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-[var(--ink-soft)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando recorridos…
              </p>
            )}

            {searchError && !searching && (
              <p className="px-4 py-3 text-[13px] text-[var(--accent-deep)]">
                No se pudo buscar recorridos. Revisa tu conexión e intenta de nuevo.
              </p>
            )}

            {!searching && !searchError && routes.length === 0 && (
              <p className="px-4 py-3 text-[13px] text-[var(--ink-soft)]">
                No encontramos recorridos con “{query}”.
              </p>
            )}

            {!searching &&
              routes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectRoute(item.id)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--mist)]"
                >
                  <span className="text-[14px] font-semibold text-[var(--ink)]">
                    {item.code} · {item.name}
                  </span>
                  <span className="text-[12px] text-[var(--ink-soft)]">
                    {item.originName} → {item.destinationName}
                  </span>
                  <span className="text-[11px] text-[var(--ink-soft)]">
                    {item.activeBuses > 0
                      ? `${item.activeBuses} ${item.activeBuses === 1 ? "micro" : "micros"} en ruta`
                      : "Sin micros en ruta ahora"}
                  </span>
                </button>
              ))}
          </div>
        )}

        {!searchOpen && (
          <div className="pointer-events-auto ml-12 flex flex-col gap-2">
            {routeLoading && (
              <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] text-[var(--ink-soft)] shadow-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando recorrido…
              </p>
            )}

            {routeError && (
              <p className="rounded-2xl bg-white px-4 py-2.5 text-[13px] text-[var(--accent-deep)] shadow-md">
                No se pudo cargar el recorrido. Elige otro o intenta de nuevo.
              </p>
            )}

            {!route && !routeLoading && !routeError && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-2xl bg-white px-4 py-2.5 text-left text-[13px] text-[var(--ink-soft)] shadow-md"
              >
                Busca tu recorrido para ver las micros en ruta.
              </button>
            )}

            {/* Responde directo el "¿viene o no viene?" sin abrir la hoja. */}
            {route && live?.outOfService && (
              <p className="rounded-2xl bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--ink)] shadow-md">
                No hay micros en ruta ahora
              </p>
            )}

            {route && liveLoading && !live && (
              <p className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] text-[var(--ink-soft)] shadow-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Consultando micros en vivo…
              </p>
            )}

            {/* Con datos previos no se borra nada: se avisa que dejaron de actualizarse. */}
            {liveError && (
              <p className="rounded-2xl bg-white px-4 py-2.5 text-[13px] text-[var(--accent-deep)] shadow-md">
                {live
                  ? "Sin conexión con el servidor — esta información dejó de actualizarse."
                  : "No se pudo consultar el estado en vivo. Reintentando…"}
              </p>
            )}

            {reportError && (
              <p className="rounded-2xl bg-white px-4 py-2.5 text-[13px] text-[var(--accent-deep)] shadow-md">
                No se pudo enviar tu reporte de ocupación.
              </p>
            )}
          </div>
        )}
      </div>

      <RideSheet
        buses={buses}
        route={route}
        stops={stops}
        selectedStopId={selectedStopId}
        onSelectStop={setSelectedStopId}
        selectedBusId={selectedBusId}
        onSelectBus={setSelectedBusId}
        onReportOccupancy={handleReportOccupancy}
        outOfService={live?.outOfService ?? true}
      />
    </div>
  )
}
