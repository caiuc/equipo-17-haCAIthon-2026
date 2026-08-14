import { useMemo } from "react"
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps"
import { getFreshness } from "@/lib/freshness"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function MapPlaceholder({ message }) {
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

// Pin circular coloreado por estado de frescura, como data URI SVG.
// Placeholder hasta que se integren los assets 3D de vehículo del equipo de diseño.
// Si el backend entrega `heading`, la flecha superior gira para mostrar hacia
// dónde iba la micro en la última lectura (el bus se mantiene derecho para que
// siga siendo legible en cualquier rumbo).
function busIcon(color, selected, heading) {
  const size = selected ? 46 : 38
  const arrow =
    heading == null
      ? ""
      : `<g transform="rotate(${heading} 20 20)"><path d="M20 0.5 L25 10 L15 10 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></g>`

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
      ${arrow}
      <circle cx="20" cy="20" r="14" fill="${color}" stroke="white" stroke-width="3"/>
      <path d="M14 16a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7.5a1.3 1.3 0 0 1-1.3 1.3H15.3A1.3 1.3 0 0 1 14 23.5z" fill="white"/>
      <circle cx="17" cy="26" r="1.4" fill="${color}"/>
      <circle cx="23" cy="26" r="1.4" fill="${color}"/>
    </svg>
  `.trim()

  return {
    url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: size, height: size },
    anchor: { x: size / 2, y: size / 2 },
  }
}

// Los paraderos son referencia, no protagonistas: punto pequeño y neutro.
function stopIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5" fill="#ffffff" stroke="#6e6e73" stroke-width="2"/>
    </svg>
  `.trim()

  return {
    url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 14, height: 14 },
    anchor: { x: 7, y: 7 },
  }
}

// Encuadre a partir de los puntos reales del recorrido: primero las micros,
// y si no hay ninguna transmitiendo, los paraderos.
function getViewport(buses, stops) {
  const points = buses.length
    ? buses.map((bus) => bus.position)
    : stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))

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

export function MapView({ buses = [], stops = [], selectedBusId, onSelectBus }) {
  const viewport = useMemo(() => getViewport(buses, stops), [buses, stops])

  if (!API_KEY) {
    return <MapPlaceholder message="Falta VITE_GOOGLE_MAPS_API_KEY en .env — mostrando placeholder de mapa" />
  }

  if (!viewport) {
    return <MapPlaceholder message="Todavía no hay posiciones que mostrar en este recorrido" />
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={viewport.center}
        defaultZoom={viewport.zoom}
        disableDefaultUI
        gestureHandling="greedy"
        className="h-full w-full"
      >
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={{ lat: stop.lat, lng: stop.lng }}
            icon={stopIcon()}
            title={`Paradero ${stop.stopOrder + 1} · ${stop.name}`}
            clickable={false}
            zIndex={1}
          />
        ))}

        {buses.map((bus) => {
          const freshness = getFreshness(bus)
          const isSelected = bus.tripId === selectedBusId

          return (
            <Marker
              key={bus.tripId}
              position={bus.position}
              onClick={() => onSelectBus?.(bus.tripId)}
              icon={busIcon(freshness.color, isSelected, bus.heading)}
              title={`${bus.driverName} · ${freshness.label}`}
              zIndex={isSelected ? 30 : 10}
            />
          )
        })}
      </Map>
    </APIProvider>
  )
}
