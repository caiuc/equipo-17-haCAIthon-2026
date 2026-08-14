import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, Search } from "lucide-react"
import { MapView } from "@/components/passenger/MapView"
import { RideSheet } from "@/components/passenger/RideSheet"
import { MOCK_MICROS } from "@/lib/mockData"

export default function PassengerApp() {
  const [selectedId, setSelectedId] = useState(MOCK_MICROS.find((m) => m.turnoActivo)?.id ?? null)

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[var(--mist)]">
      <MapView micros={MOCK_MICROS} selectedId={selectedId} onSelect={setSelectedId} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-4">
        <Link
          to="/"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
        >
          <ChevronLeft className="h-5 w-5 text-[var(--ink)]" />
        </Link>
        <div className="pointer-events-auto flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-md">
          <Search className="h-4 w-4 text-[var(--ink-soft)]" />
          <span className="truncate text-[14px] text-[var(--ink-soft)]">Buscar recorrido o paradero</span>
        </div>
      </div>

      <RideSheet micros={MOCK_MICROS} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  )
}
