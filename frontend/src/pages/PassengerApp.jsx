import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ListFilter, Loader2, Search, Star, X } from "lucide-react"
import { MapView } from "@/components/passenger/MapView"
import { RideSheet } from "@/components/passenger/RideSheet"
import { FilterSheet } from "@/components/passenger/FilterSheet"
import { useCompanies } from "@/hooks/useCompanies"
import { useElapsedSince } from "@/hooks/useElapsedSince"
import { useFavorites } from "@/hooks/useFavorites"
import { useLiveBuses } from "@/hooks/useLiveBuses"
import { useLiveRoute } from "@/hooks/useLiveRoute"
import { useRegions } from "@/hooks/useRegions"
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

  const [companyIds, setCompanyIds] = useState([])
  const [zoneId, setZoneId] = useState(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { companies } = useCompanies()
  const { regions } = useRegions()
  const { isFavorite, toggleFavorite } = useFavorites()

  const {
    routes: searchedRoutes,
    loading: searching,
    error: searchError,
  } = useRouteSearch(query, { companyIds, zoneId })

  // El toggle de favoritos filtra en el cliente: los favoritos viven solo en
  // este dispositivo, el backend no sabe nada de ellos.
  const routes = favoritesOnly
    ? searchedRoutes.filter((item) => isFavorite(item.id))
    : searchedRoutes

  const activeZoneName = useMemo(() => {
    if (!zoneId) return null
    for (const region of regions) {
      const zone = region.zones.find((z) => z.id === zoneId)
      if (zone) return zone.name
    }
    return null
  }, [regions, zoneId])

  const selectedCompanies = useMemo(
    () => companies.filter((c) => companyIds.includes(c.id)),
    [companies, companyIds],
  )

  const hasActiveFilters = companyIds.length > 0 || Boolean(zoneId) || favoritesOnly

  const removeCompanyFilter = (id) => setCompanyIds((prev) => prev.filter((c) => c !== id))
  const {
    live,
    receivedAt: liveReceivedAt,
    loading: liveLoading,
    error: liveError,
    refresh,
  } = useLiveRoute(route?.id ?? null, selectedStopId)

  // Mientras no hay recorrido elegido el mapa muestra todo lo que se mueve, de
  // todas las empresas: es la respuesta a "¿hay algo andando?" antes de saber
  // que recorrido buscar. Al elegir uno, manda la consulta del recorrido.
  const {
    buses: mapBuses,
    truncated,
    receivedAt: mapReceivedAt,
    refresh: refreshMap,
  } = useLiveBuses({ enabled: !route })

  const stops = route?.stops ?? []
  const buses = route ? (live?.buses ?? []) : mapBuses
  const outOfService = route ? (live?.outOfService ?? true) : mapBuses.length === 0

  // Envejece lo mostrado entre consultas: si el polling se corta, las micros se
  // degradan solas a "Señal intermitente" y "Sin señal" en vez de quedarse
  // congeladas diciendo "En vivo".
  const elapsedMs = useElapsedSince(route ? liveReceivedAt : mapReceivedAt)

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
    if (route) refresh()
    else refreshMap()
  }

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[var(--mist)]">
      <MapView
        buses={buses}
        stops={stops}
        selectedBusId={selectedBusId}
        onSelectBus={setSelectedBusId}
        elapsedMs={elapsedMs}
        fitKey={route?.id ?? "map"}
      />

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
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filtros"
            className={`pointer-events-auto relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-md ${
              hasActiveFilters ? "ring-2 ring-[var(--ink)]" : ""
            }`}
          >
            <ListFilter className="h-4.5 w-4.5 text-[var(--ink)]" />
          </button>
        </div>

        {hasActiveFilters && (
          <div className="pointer-events-auto ml-12 flex flex-wrap gap-1.5">
            {favoritesOnly && (
              <button
                type="button"
                onClick={() => setFavoritesOnly(false)}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] shadow-md"
              >
                <Star className="h-3 w-3 fill-current" /> Favoritos
                <X className="h-3 w-3 text-[var(--ink-soft)]" />
              </button>
            )}
            {activeZoneName && (
              <button
                type="button"
                onClick={() => setZoneId(null)}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] shadow-md"
              >
                {activeZoneName}
                <X className="h-3 w-3 text-[var(--ink-soft)]" />
              </button>
            )}
            {selectedCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => removeCompanyFilter(c.id)}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] shadow-md"
              >
                {c.name}
                <X className="h-3 w-3 text-[var(--ink-soft)]" />
              </button>
            ))}
          </div>
        )}

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
                {favoritesOnly
                  ? "No tienes recorridos favoritos que calcen con estos filtros."
                  : `No encontramos recorridos con “${query}”.`}
              </p>
            )}

            {!searching &&
              routes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-1 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--mist)]"
                >
                  <button
                    type="button"
                    onClick={() => selectRoute(item.id)}
                    className="flex flex-1 flex-col items-start gap-0.5 px-4 py-3 text-left"
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
                  <button
                    type="button"
                    onClick={() => toggleFavorite(item.id)}
                    aria-label={isFavorite(item.id) ? "Quitar de favoritos" : "Agregar a favoritos"}
                    aria-pressed={isFavorite(item.id)}
                    className="shrink-0 px-3.5 py-3 text-[var(--ink-soft)]"
                  >
                    <Star
                      className={`h-4.5 w-4.5 ${isFavorite(item.id) ? "fill-current text-[var(--ink)]" : ""}`}
                    />
                  </button>
                </div>
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
        outOfService={outOfService}
        elapsedMs={elapsedMs}
        truncated={truncated}
      />

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        selectedCompanyIds={companyIds}
        selectedZoneId={zoneId}
        favoritesOnly={favoritesOnly}
        onApply={(next) => {
          setCompanyIds(next.companyIds)
          setZoneId(next.zoneId)
          setFavoritesOnly(next.favoritesOnly)
        }}
      />
    </div>
  )
}
