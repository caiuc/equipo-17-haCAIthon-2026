import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ListFilter, Loader2, Search, Star, X } from "lucide-react"
import { MapView } from "@/components/passenger/MapView"
import { RideSheet } from "@/components/passenger/RideSheet"
import { FilterSheet } from "@/components/passenger/FilterSheet"
import { LocateButton } from "@/components/passenger/LocateButton"
import { useCompanies } from "@/hooks/useCompanies"
import { useCompany } from "@/hooks/useCompany"
import { useElapsedSince } from "@/hooks/useElapsedSince"
import { useFavorites } from "@/hooks/useFavorites"
import { useLiveBuses } from "@/hooks/useLiveBuses"
import { useLiveRoute } from "@/hooks/useLiveRoute"
import { useRegions } from "@/hooks/useRegions"
import { useRouteDetail } from "@/hooks/useRouteDetail"
import { useRouteSearch } from "@/hooks/useRouteSearch"
import { useUserLocation } from "@/hooks/useUserLocation"
import { getRoute, reportOccupancy } from "@/lib/api"
import { getCompanyFilter, setCompanyFilter } from "@/lib/companyFilter"
import { nearestStop } from "@/lib/geo"
import { getVotes, saveVote } from "@/lib/occupancyVotes"

// Identidad estable para el caso "sin recorrido elegido": un `[]` nuevo en cada
// render invalidaria los useMemo del mapa y redibujaria el trazado sin parar.
const NO_STOPS = []
const NO_BUSES = []

export default function PassengerApp() {
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(true)
  const [route, setRoute] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [selectedStopId, setSelectedStopId] = useState(null)
  const [selectedBusId, setSelectedBusId] = useState(null)
  const [reportError, setReportError] = useState(null)
  // Ocupacion recalculada que devuelve el POST del reporte. Se muestra al
  // instante y manda hasta que un poll traiga una version mas nueva: sin esto la
  // tarjeta seguia con el dato viejo cinco segundos y el toque parecia perdido.
  const [occupancyOverrides, setOccupancyOverrides] = useState({})
  const [myVotes, setMyVotes] = useState(getVotes)
  // Contador y no booleano: cada toque del boton vuelve a centrar, aunque la
  // camara ya haya estado ahi.
  const [recenterToken, setRecenterToken] = useState(0)
  // Se inicializa leyendo localStorage una sola vez (forma perezosa del useState):
  // en cada render seria un acceso sincrono al storage por frame.
  const [companyIds, setCompanyIds] = useState(getCompanyFilter)

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

  const clearCompanies = () => {
    setCompanyIds([])
    setCompanyFilter([])
    setZoneId(null)
    setFavoritesOnly(false)
  }

  const hasActiveFilters = companyIds.length > 0 || Boolean(zoneId) || favoritesOnly

  const removeCompanyFilter = (id) =>
    setCompanyIds((prev) => {
      const siguientes = prev.filter((c) => c !== id)
      setCompanyFilter(siguientes)
      return siguientes
    })
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

  const stops = route?.stops ?? NO_STOPS
  // Igual que NO_STOPS: identidad estable, o el `[]` nuevo de cada render haria
  // recalcular el filtro y el conteo por empresa en cada frame.
  const busesSinFiltrar = useMemo(
    () => (route ? (live?.buses ?? NO_BUSES) : mapBuses),
    [route, live, mapBuses],
  )


  /*
   * El filtro se aplica en el CLIENTE, no pidiendole al servidor.
   *
   * `/api/live/buses` acepta un solo `companyId`, asi que una seleccion multiple
   * obligaria a N peticiones por tick de polling y a mezclar respuestas de
   * instantes distintos — justo lo que el principio rector prohibe, porque cada
   * micro viaja con su propia frescura y unirlas las mezclaria.
   *
   * Ademas `useLiveBuses` usa `companyId` como `resetKey`: mandarlo al servidor
   * vaciaria la lista en cada toque del chip y el mapa parpadearia. Con 24 micros
   * el payload completo es de unos pocos KB y filtrar es un `includes`.
   */
  const buses = useMemo(() => {
    if (companyIds.length === 0) return busesSinFiltrar
    return busesSinFiltrar.filter((bus) => companyIds.includes(bus.company.id))
  }, [busesSinFiltrar, companyIds])

  // El buscador se filtra con el mismo criterio: `routeSummary` ya trae `company`,
  // asi que no hace falta ninguna peticion extra.
  const routesFiltradas = useMemo(() => {
    if (companyIds.length === 0) return routes
    return routes.filter((item) => companyIds.includes(item.company.id))
  }, [routes, companyIds])

  const empresasFiltradas = useMemo(
    () => companies.filter((company) => companyIds.includes(company.id)),
    [companies, companyIds],
  )

  // El filtro dejo cero micros pero SI habia micros en ruta: es un caso distinto
  // de "no hay nada andando" y hay que decirlo con esas palabras.
  const vacioPorFiltro = companyIds.length > 0 && buses.length === 0

  const outOfService = route
    ? (live?.outOfService ?? true)
    : buses.length === 0



  /*
   * Lo que respondio el POST del reporte pisa a lo que trajo el ultimo poll,
   * pero solo mientras sea mas nuevo. Las dos versiones son del mismo servidor y
   * traen `updatedAt` ISO, asi que comparar cadenas alcanza y el estado local se
   * descarta solo en cuanto el polling se pone al dia: nada queda pegado.
   */
  const busesConReporte = useMemo(() => {
    if (Object.keys(occupancyOverrides).length === 0) return buses

    return buses.map((bus) => {
      const mio = occupancyOverrides[bus.tripId]
      if (!mio) return bus
      const delServidor = bus.occupancy?.updatedAt
      if (delServidor && delServidor >= (mio.updatedAt ?? "")) return bus
      return { ...bus, occupancy: mio }
    })
  }, [buses, occupancyOverrides])

  const selectedBus = busesConReporte.find((bus) => bus.tripId === selectedBusId) ?? null

  const { status: locationStatus, position: userPosition, request: requestLocation } =
    useUserLocation()

  // Con la ubicacion a mano, el paradero mas cercano se calcula aca mismo: es
  // una cuenta sobre datos que ya estan en memoria y no justifica una consulta.
  const nearest = useMemo(() => nearestStop(userPosition, stops), [userPosition, stops])

  // El detalle del recorrido de la micro abierta. Con recorrido ya elegido se
  // reusa el que hay; en el mapa general se pide (y se cachea) el de la micro.
  const detailRouteId = selectedBus?.routeId ?? null
  const { route: detailRouteFetched, loading: detailRouteLoading } = useRouteDetail(
    detailRouteId && detailRouteId !== route?.id ? detailRouteId : null,
  )
  const detailRoute = detailRouteId === route?.id ? route : detailRouteFetched
  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? null

  // La ficha sigue a la micro elegida, y si no hay ninguna elegida, a la empresa
  // del recorrido. Ese segundo caso es el que mas importa: cuando no hay ninguna
  // micro transmitiendo no queda micro que seleccionar, y el telefono de la
  // empresa pasa a ser la unica respuesta util que podemos dar.
  const companyId = selectedBus?.company?.id ?? route?.company?.id ?? null
  const { company, loading: companyLoading } = useCompany(companyId)

  const companyFares = useMemo(() => {
    if (route) return route.fares ?? []
    // En el mapa sin recorrido elegido la micro solo trae la tarifa de adulto.
    // null es "no publicada" y NO se convierte en una fila: formatFare ya sabe
    // decir "Tarifa por confirmar" cuando no hay dato.
    return [{ passengerType: "ADULT", amountClp: selectedBus?.fareAdultClp ?? null }].filter(
      (fare) => fare.amountClp != null,
    )
  }, [route, selectedBus])

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
    // El voto se marca antes de la respuesta: es lo que la persona acaba de
    // decir, y la interfaz no puede quedarse muda esperando a la red rural.
    setMyVotes(saveVote(tripId, full))

    try {
      const payload = await reportOccupancy(tripId, full)
      // El endpoint devuelve la ocupacion ya recalculada. Descartarla obligaba a
      // esperar el siguiente poll para ver cualquier efecto del propio voto.
      if (payload?.occupancy) {
        setOccupancyOverrides((previas) => ({ ...previas, [tripId]: payload.occupancy }))
      }
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
        pathPolyline={route?.pathPolyline ?? null}
        selectedBusId={selectedBusId}
        onSelectBus={setSelectedBusId}
        selectedStopId={selectedStopId}
        onSelectStop={setSelectedStopId}
        routeColor={route?.company?.color}
        userPosition={userPosition}
        recenterToken={recenterToken}
        elapsedMs={elapsedMs}
        // El filtro entra en la clave para que la camara vuelva a encuadrar sobre
        // las micros que quedaron: filtrar y que el mapa siga mirando a otro lado
        // no se lee como un filtro, se lee como que no paso nada.
        fitKey={`${route?.id ?? "map"}|${companyIds.join(",")}`}
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

            {!searching && !searchError && routesFiltradas.length === 0 && (
              <p className="px-4 py-3 text-[13px] text-[var(--ink-soft)]">
                {favoritesOnly
                  ? "No tienes recorridos favoritos que calcen con estos filtros."
                  : routes.length > 0
                    ? `Ninguna empresa filtrada tiene recorridos con “${query}”.`
                  : `No encontramos recorridos con “${query}”.`}
              </p>
            )}

            {!searching &&
              routesFiltradas.map((item) => (
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

            {!route && !routeLoading && !routeError && !vacioPorFiltro && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-2xl bg-white px-4 py-2.5 text-left text-[13px] text-[var(--ink-soft)] shadow-md"
              >
                Busca tu recorrido para ver las micros en ruta.
              </button>
            )}

            {/* Una lista vacia sin texto no responde "¿viene o no viene?". Si el
                filtro es el que dejo el mapa en cero, se dice con el nombre de la
                empresa y se ofrece el camino de vuelta. */}
            {vacioPorFiltro && (
              <div className="rounded-2xl bg-white px-4 py-2.5 shadow-md">
                <p className="text-[13px] font-semibold text-[var(--ink)]">
                  {empresasFiltradas.length === 1
                    ? `Ninguna micro de ${empresasFiltradas[0]?.name} está en ruta ahora.`
                    : `Ninguna micro de las ${empresasFiltradas.length} empresas filtradas está en ruta ahora.`}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                  {busesSinFiltrar.length > 0
                    ? `Hay ${busesSinFiltrar.length} ${
                        busesSinFiltrar.length === 1 ? "micro" : "micros"
                      } de otras empresas en ruta.`
                    : "Tampoco hay micros de otras empresas en ruta."}
                </p>
                <button
                  type="button"
                  onClick={clearCompanies}
                  className="mt-1.5 text-[13px] font-medium text-[var(--accent-deep)]"
                >
                  Quitar el filtro
                </button>
              </div>
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

      <LocateButton
        status={locationStatus}
        accuracy={userPosition?.accuracy ?? null}
        onRequest={() => {
          requestLocation()
          setRecenterToken((token) => token + 1)
        }}
      />

      <RideSheet
        buses={busesConReporte}
        route={route}
        stops={stops}
        selectedStopId={selectedStopId}
        onSelectStop={setSelectedStopId}
        selectedBusId={selectedBusId}
        onSelectBus={setSelectedBusId}
        onReportOccupancy={handleReportOccupancy}
        outOfService={outOfService}
        elapsedMs={elapsedMs}
        // El aviso de "hay mas micros" lo calcula el servidor sobre la lista sin
        // filtrar: con el filtro puesto seria una advertencia sobre micros que el
        // pasajero ya decidio no mirar.
        truncated={truncated && companyIds.length === 0}
        company={company}
        companyLoading={companyLoading}
        companyFares={companyFares}
        myVotes={myVotes}
        nearestStop={nearest}
        // Con una micro elegida la hoja deja de ser lista y pasa a ser su ficha:
        // todo lo que necesita para eso viaja junto, y lo vivo sigue vivo porque
        // `selectedBus` sale del mismo polling que alimenta el mapa.
        selectedBus={selectedBus}
        detailRoute={detailRoute}
        detailRouteLoading={detailRouteLoading}
        selectedStop={selectedStop}
      />

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        selectedCompanyIds={companyIds}
        selectedZoneId={zoneId}
        favoritesOnly={favoritesOnly}
        onApply={(next) => {
          setCompanyIds(next.companyIds)
          setCompanyFilter(next.companyIds)
          setZoneId(next.zoneId)
          setFavoritesOnly(next.favoritesOnly)
        }}
      />
    </div>
  )
}
