import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { searchRoutes } from "@/lib/api"

export default function RouteSearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchRoutes(query)
        if (!cancelled) {
          setRoutes(results)
          setError(null)
        }
      } catch {
        if (!cancelled) setError("No se pudo cargar los recorridos. Intenta de nuevo.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [query])

  return (
    <div className="min-h-svh w-full bg-[var(--mist)]">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--line)] bg-white/95 p-4 backdrop-blur-xl">
        <Link
          to="/"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mist)]"
        >
          <ChevronLeft className="h-5 w-5 text-[var(--ink)]" />
        </Link>
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[var(--mist)] px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-[var(--ink-soft)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar recorrido, código o destino"
            className="w-full bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
          />
        </div>
      </div>

      <div className="px-4 py-3">
        {error && <p className="px-1 py-4 text-[13px] text-[var(--accent-deep)]">{error}</p>}

        {!error && loading && <p className="px-1 py-4 text-[13px] text-[var(--ink-soft)]">Buscando recorridos…</p>}

        {!error && !loading && routes.length === 0 && (
          <p className="px-1 py-4 text-[13px] text-[var(--ink-soft)]">
            No se encontraron recorridos para “{query}”.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => navigate(`/app/routes/${route.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white px-4 py-3 text-left transition-colors hover:border-[var(--line)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[var(--ink)]">{route.name}</p>
                <p className="truncate text-[13px] text-[var(--ink-soft)]">
                  {route.originName} → {route.destinationName}
                </p>
                <p className="truncate text-[12px] text-[var(--ink-soft)]">{route.companyName}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2 text-right">
                <div>
                  <p className="text-[13px] font-medium text-[var(--ink)]">
                    {route.activeBuses > 0 ? `${route.activeBuses} en ruta` : "Sin micros"}
                  </p>
                  <p className="text-[11px] text-[var(--ink-soft)]">{route.code}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--ink-soft)]" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
