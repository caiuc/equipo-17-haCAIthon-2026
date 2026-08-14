import { useEffect, useMemo, useRef } from "react"
import {
  APIProvider,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  Map,
  useMap,
} from "@vis.gl/react-google-maps"
import { BusSprite } from "@/components/passenger/BusSprite"
import { getFreshness } from "@/lib/freshness"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID

// Talagante–Peñaflor: donde vive la flota sembrada. Solo es el encuadre inicial
// mientras no hay ninguna posicion; en cuanto llega una, la camara la sigue.
const DEFAULT_VIEWPORT = { center: { lat: -33.66, lng: -70.93 }, zoom: 11 }

const SPRITE_SIZE = 44
const SPRITE_SIZE_SELECTED = 56

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

// Los paraderos son referencia, no protagonistas: punto pequeño y neutro.
function StopDot() {
  return (
    <span className="block h-3.5 w-3.5 rounded-full border-2 border-[#6e6e73] bg-white" />
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
 */
function MapCamera({ viewport, fitKey }) {
  const map = useMap()
  const fitted = useRef(null)

  useEffect(() => {
    if (!map || !viewport || fitted.current === fitKey) return
    fitted.current = fitKey
    map.moveCamera({ center: viewport.center, zoom: viewport.zoom })
  }, [map, viewport, fitKey])

  return null
}

export function MapView({
  buses = [],
  stops = [],
  selectedBusId,
  onSelectBus,
  elapsedMs = 0,
  fitKey = "map",
}) {
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
        <MapCamera viewport={viewport} fitKey={fitKey} />

        {stops.map((stop) => (
          <AdvancedMarker
            key={stop.id}
            position={{ lat: stop.lat, lng: stop.lng }}
            anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
            title={`Paradero ${stop.stopOrder + 1} · ${stop.name}`}
            clickable={false}
            zIndex={1}
          >
            <StopDot />
          </AdvancedMarker>
        ))}

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
                companyColor={bus.company.color}
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
