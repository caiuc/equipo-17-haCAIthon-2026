import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { MapView } from "@/components/passenger/MapView"
import { RideSheet } from "@/components/passenger/RideSheet"
import { getRoute, reportOccupancy, ApiError } from "@/lib/api"
import { useLiveRoute } from "@/lib/useLiveRoute"
import { getDeviceId } from "@/lib/deviceId"

const DEFAULT_CENTER = { lat: -33.45, lng: -70.66 }

export default function RouteLivePage() {
  const { id } = useParams()
  const [route, setRoute] = useState(null)
  const [routeError, setRouteError] = useState(null)
  const [selectedTripId, setSelectedTripId] = useState(null)
  const { live, error: liveError } = useLiveRoute(id)

  useEffect(() => {
    let cancelled = false
    getRoute(id)
      .then((data) => {
        if (!cancelled) setRoute(data)
      })
      .catch(() => {
        if (!cancelled) setRouteError("No se pudo cargar el recorrido.")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleReportFull(tripId, full) {
    try {
      await reportOccupancy(tripId, full, { deviceId: getDeviceId() })
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
    }
  }

  if (routeError) {
    return (
      <div className="flex h-svh w-full flex-col items-center justify-center gap-3 bg-[var(--mist)] p-6 text-center">
        <p className="text-[14px] text-[var(--ink-soft)]">{routeError}</p>
        <Link to="/app" className="text-[14px] font-medium text-[var(--accent-deep)]">
          Volver a la búsqueda
        </Link>
      </div>
    )
  }

  const buses = live?.buses ?? []
  const center = route?.stops?.[0] ? { lat: route.stops[0].lat, lng: route.stops[0].lng } : DEFAULT_CENTER

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[var(--mist)]">
      <MapView
        center={center}
        stops={route?.stops ?? []}
        buses={buses}
        selectedTripId={selectedTripId}
        onSelect={setSelectedTripId}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-4">
        <Link
          to="/app"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
        >
          <ChevronLeft className="h-5 w-5 text-[var(--ink)]" />
        </Link>
        {liveError && (
          <div className="pointer-events-auto flex-1 rounded-full bg-white px-4 py-2.5 text-[13px] text-[var(--accent-deep)] shadow-md">
            Sin conexión — reintentando…
          </div>
        )}
      </div>

      <RideSheet
        routeName={live?.routeName ?? route?.name ?? ""}
        buses={buses}
        outOfService={live?.outOfService ?? true}
        selectedTripId={selectedTripId}
        onSelect={setSelectedTripId}
        onReportFull={handleReportFull}
      />
    </div>
  )
}
