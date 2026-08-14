import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps"
import { RURAL_CENTER } from "@/lib/mockData"
import { getFreshness } from "@/lib/freshness"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function MapUnavailable() {
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
      <p className="relative rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[13px] text-[var(--ink-soft)] shadow-sm">
        Falta VITE_GOOGLE_MAPS_API_KEY en .env — mostrando placeholder de mapa
      </p>
    </div>
  )
}

// Pin circular coloreado por estado de frescura, como data URI SVG.
// Placeholder hasta que se integren los assets 3D de vehículo del equipo de diseño.
function busIcon(color, selected) {
  const size = selected ? 44 : 36
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="17" fill="${color}" stroke="white" stroke-width="3"/>
      <path d="M13 15a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a1.5 1.5 0 0 1-1.5 1.5H14.5A1.5 1.5 0 0 1 13 24z" fill="white"/>
      <circle cx="16.5" cy="26" r="1.6" fill="${color}"/>
      <circle cx="23.5" cy="26" r="1.6" fill="${color}"/>
    </svg>
  `.trim()

  return {
    url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: size, height: size },
    anchor: { x: size / 2, y: size / 2 },
  }
}

export function MapView({ micros, selectedId, onSelect }) {
  if (!API_KEY) return <MapUnavailable />

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={RURAL_CENTER}
        defaultZoom={14}
        disableDefaultUI
        gestureHandling="greedy"
        className="h-full w-full"
      >
        {micros
          .filter((micro) => micro.turnoActivo)
          .map((micro) => {
            const freshness = getFreshness(micro.lastSeenAt, micro.turnoActivo)
            const isSelected = micro.id === selectedId

            return (
              <Marker
                key={micro.id}
                position={micro.position}
                onClick={() => onSelect(micro.id)}
                icon={busIcon(freshness.color, isSelected)}
                zIndex={isSelected ? 10 : 1}
              />
            )
          })}
      </Map>
    </APIProvider>
  )
}
