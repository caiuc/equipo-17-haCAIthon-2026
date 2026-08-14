import { Link } from "react-router-dom"
import { ArrowRight, MapPin, Clock, Navigation } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="min-h-svh w-full bg-gradient-to-b from-white to-[var(--mist)]">
      {/* Header */}
      <div className="border-b border-[var(--line)] bg-white/50 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">Miqui</h1>
            <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
              Sigue tus recorridos en tiempo real
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-[var(--line)]">
          <div className="flex items-start gap-4">
            <Navigation className="h-10 w-10 shrink-0 text-[var(--accent)]" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--ink)]">
                ¿Qué puedes hacer?
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                Busca recorridos, ve dónde están los micros en tiempo real y
                sigue tu viaje sin perder detalle.
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="space-y-4">
          {/* Buscar Recorrido */}
          <Link
            to="/app"
            className="group block rounded-2xl bg-white p-5 shadow-sm border border-[var(--line)] transition-all hover:shadow-md hover:border-[var(--accent)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--ink)]">
                  Buscar recorrido
                </h3>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  Encuentra rutas disponibles y ve los micros en ruta
                </p>
              </div>
              <MapPin className="h-6 w-6 shrink-0 text-[var(--accent)] opacity-60 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-[var(--accent)]">
              Abrir
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          {/* Próximamente */}
          <div className="rounded-2xl bg-[var(--mist)] p-5 border border-[var(--line)] opacity-60">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--ink)]">
                  Mis recorridos
                </h3>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  Guarda y accede rápido a tus rutas favoritas
                </p>
              </div>
              <Clock className="h-6 w-6 shrink-0 text-[var(--ink-soft)]" />
            </div>
            <div className="mt-4 text-[12px] font-medium text-[var(--ink-soft)]">
              Próximamente
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
