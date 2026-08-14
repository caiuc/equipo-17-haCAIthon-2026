import { useEffect, useMemo, useRef } from "react"
import {
  APIProvider,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps"
import { BusSprite } from "@/components/passenger/BusSprite"
import { RoutePolyline } from "@/components/passenger/RoutePolyline"
import { UserLocationMarker } from "@/components/passenger/UserLocationMarker"
import { useRoutePath } from "@/hooks/useRoutePath"
import { getFreshness } from "@/lib/freshness"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID

// Talagante–Peñaflor: donde vive la flota sembrada. Solo es el encuadre inicial
// mientras no hay ninguna posicion; en cuanto llega una, la camara la sigue.
const DEFAULT_VIEWPORT = { center: { lat: -33.66, lng: -70.93 }, zoom: 11 }

const SPRITE_SIZE = 44
const SPRITE_SIZE_SELECTED = 56

/**
 * Margen inferior del encuadre, como fraccion del alto del mapa. La hoja de
 * micros tapa la parte de abajo de la pantalla, asi que un `fitBounds` sin este
 * margen deja medio recorrido debajo de ella: se dibuja, pero no se ve. Es
 * proporcional y no un numero fijo porque la hoja se mide en `vh`.
 */
const FIT_BOTTOM_RATIO = 0.42

/** Buscador y filtro de empresas flotan sobre el mapa: ese alto tampoco sirve. */
const FIT_TOP_PX = 132

const fitPadding = (map) => {
  const height = map.getDiv()?.offsetHeight ?? 0
  return {
    top: FIT_TOP_PX,
    bottom: Math.round(height * FIT_BOTTOM_RATIO) || 220,
    left: 32,
    right: 32,
  }
}

/**
 * Cuando falta una credencial se declara la carencia en vez de fingir un mapa.
 * Es el mismo principio que con las posiciones viejas: mejor decir que no hay
 * dato que mostrar algo que parece dato.
 */
function MapUnavailable({ message }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--mist)]">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <p className="relative mx-6 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-center text-[13px] text-[var(--ink-soft)] shadow-sm">
        {message}
      </p>
    </div>
  )
}

/**
 * Los paraderos son referencia, no protagonistas: punto pequeño y neutro. Con
 * 61 paraderos en un recorrido de MuniBus Paine, cualquier cosa mas grande
 * convierte el trazado en una tira de bolitas.
 *
 * El elegido si se destaca: es el punto contra el que se miden todas las
 * distancias de la lista, y tiene que poder localizarse de un vistazo.
 */
function StopDot({ selected }) {
  if (selected) {
    return (
      <span className="block h-5 w-5 rounded-full border-[3px] border-[var(--ink)] bg-white shadow-md" />
    )
  }

  return (
    <span className="block h-2.5 w-2.5 rounded-full border-2 border-white bg-[#6e6e73] shadow-sm" />
  )
}

/**
 * Encuadre a partir de los puntos reales: primero las micros, y si no hay
 * ninguna transmitiendo, los paraderos.
 */
function getViewport(points) {
  if (!points.length) return null

  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }

  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
  let zoom = 15
  if (span > 0.6) zoom = 10
  else if (span > 0.3) zoom = 11
  else if (span > 0.15) zoom = 12
  else if (span > 0.07) zoom = 13
  else if (span > 0.03) zoom = 14

  return { center, zoom }
}

/**
 * Encuadra una sola vez por `fitKey` (el recorrido elegido). Reencuadrar en cada
 * consulta le arrebataria el mapa al pasajero que lo esta moviendo con el dedo.
 *
 * Con recorrido elegido manda el trazado completo y no las micros: al abrir un
 * recorrido la pregunta es "por donde pasa", y encuadrar sobre la unica micro en
 * ruta dejaria el resto de la ruta fuera de pantalla.
 */
function MapCamera({ path, viewport, fitKey }) {
  const map = useMap()
  const core = useMapsLibrary("core")
  const fitted = useRef(null)

  useEffect(() => {
    if (!map || fitted.current === fitKey) return

    if (core && path.length > 1) {
      const bounds = new core.LatLngBounds()
      for (const point of path) bounds.extend(point)
      fitted.current = fitKey
      map.fitBounds(bounds, fitPadding(map))
      return
    }

    if (!viewport) return
    fitted.current = fitKey
    map.moveCamera({ center: viewport.center, zoom: viewport.zoom })
  }, [map, core, path, viewport, fitKey])

  return null
}

/**
 * Lleva la camara a la ubicacion del pasajero, y solo cuando el la pide.
 *
 * El disparador es un contador que incrementa el boton, no la posicion: con
 * `watchPosition` la posicion cambia cada pocos segundos, y seguirla siempre le
 * arrebataria el mapa a quien lo esta explorando con el dedo.
 */
function UserCamera({ position, token }) {
  const map = useMap()
  const centered = useRef(0)

  useEffect(() => {
    if (!map || !position || token === centered.current) return
    centered.current = token
    map.panTo({ lat: position.lat, lng: position.lng })
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15)
  }, [map, position, token])

  return null
}

/**
 * Trazado del recorrido y encuadre, juntos porque comparten los mismos puntos:
 * el mapa se encuadra sobre exactamente la linea que se dibuja.
 *
 * Va dentro de `<Map>` a proposito: `useRoutePath` necesita la libreria
 * `geometry` de Google, y `useMapsLibrary` solo la resuelve bajo el APIProvider.
 */
function RouteOverlay({ pathPolyline, stops, color, viewport, fitKey }) {
  const path = useRoutePath(pathPolyline, stops)

  return (
    <>
      <MapCamera path={path} viewport={viewport} fitKey={fitKey} />
      <RoutePolyline path={path} color={color} />
    </>
  )
}

export function MapView({
  buses = [],
  stops = [],
  pathPolyline = null,
  selectedBusId,
  onSelectBus,
  selectedStopId,
  onSelectStop,
  routeColor,
  userPosition = null,
  recenterToken = 0,
  elapsedMs = 0,
  fitKey = "map",
}) {
  // Encuadre de respaldo para cuando no hay recorrido elegido y por lo tanto no
  // hay trazado sobre el que hacer fitBounds.
  const viewport = useMemo(() => {
    const points = buses.length
      ? buses.map((bus) => bus.position)
      : stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))
    return getViewport(points)
  }, [buses, stops])

  if (!API_KEY || !MAP_ID) {
    return (
      <MapUnavailable
        message={
          !API_KEY
            ? "Falta VITE_GOOGLE_MAPS_API_KEY en .env — no podemos dibujar el mapa"
            : "Falta VITE_GOOGLE_MAPS_MAP_ID en .env — sin Map ID vectorial los sprites no pueden rotar"
        }
      />
    )
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        mapId={MAP_ID}
        defaultCenter={DEFAULT_VIEWPORT.center}
        defaultZoom={DEFAULT_VIEWPORT.zoom}
        // El contenido de un AdvancedMarker es DOM en el plano de la pantalla:
        // no se inclina ni gira con el suelo, asi que el suelo tampoco se mueve.
        tilt={0}
        heading={0}
        disableDefaultUI
        gestureHandling="greedy"
        className="h-full w-full"
      >
        <RouteOverlay
          pathPolyline={pathPolyline}
          stops={stops}
          color={routeColor}
          viewport={viewport}
          fitKey={fitKey}
        />

        <UserCamera position={userPosition} token={recenterToken} />
        <UserLocationMarker position={userPosition} />

        {stops.map((stop) => {
          const isSelected = stop.id === selectedStopId

          return (
            <AdvancedMarker
              key={stop.id}
              position={{ lat: stop.lat, lng: stop.lng }}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              title={`Paradero ${stop.stopOrder + 1} · ${stop.name}`}
              // Con 61 paraderos el selector horizontal de la hoja es
              // impracticable: tocar el punto en el mapa es la forma natural de
              // decir "yo estoy aca".
              onClick={() => onSelectStop?.(isSelected ? null : stop.id)}
              zIndex={isSelected ? 10 : 2}
            >
              <StopDot selected={isSelected} />
            </AdvancedMarker>
          )
        })}

        {buses.map((bus) => {
          const freshness = getFreshness(bus, elapsedMs)
          const isSelected = bus.tripId === selectedBusId

          return (
            <AdvancedMarker
              key={bus.tripId}
              position={bus.position}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              onClick={() => onSelectBus?.(bus.tripId)}
              title={`${bus.routeCode} · ${bus.company.name} · ${freshness.label}`}
              zIndex={isSelected ? 40 : freshness.sprite.zIndex}
            >
              <BusSprite
                assetSlug={bus.company.assetSlug}
                heading={bus.heading}
                status={freshness.status}
                statusLabel={`${bus.routeCode} — ${freshness.message}`}
                size={isSelected ? SPRITE_SIZE_SELECTED : SPRITE_SIZE}
                selected={isSelected}
                label={`${bus.routeCode} · ${freshness.label}`}
              />
            </AdvancedMarker>
          )
        })}
      </Map>
    </APIProvider>
  )
}
