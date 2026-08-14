import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { PulseDot } from "./PulseDot"

const ROUTE_PATH = "M10 120 C 70 120, 90 30, 150 30 S 230 90, 270 20"

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-220px] -z-10 mx-auto h-[520px] max-w-[900px] rounded-full opacity-70 blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, var(--accent-soft), transparent)",
        }}
      />

      <div className="mx-auto grid max-w-[1120px] items-center gap-16 px-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-[13px] text-[var(--ink-soft)]">
            <PulseDot />
            Transporte rural, visible
          </div>

          <h1 className="max-w-[16ch] text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-[var(--ink)] md:text-[60px]">
            Sabe cuándo llega tu micro. Aunque sea rural.
          </h1>

          <p className="mt-6 max-w-[46ch] text-[18px] leading-[1.5] text-[var(--ink-soft)] md:text-[20px]">
            Miqui conecta a pasajeros y conductores de micros rurales, para
            que nadie más espere en un paradero sin saber si el bus ya pasó,
            cuánto falta, o si viene.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button
              render={<Link to="/dashboard" />}
              className="h-12 rounded-full bg-[var(--accent)] px-6 text-[15px] font-medium text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--accent-deep)] active:translate-y-0"
            >
              Empezar a usarla
            </Button>
            <a
              href="#problema"
              className="text-[15px] font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
            >
              Conoce el problema
            </a>
          </div>
        </div>

        <RouteCard />
      </div>
    </section>
  )
}

function RouteCard() {
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-[0_30px_60px_-30px_rgba(29,29,31,0.25)] backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[var(--ink-soft)]">
            Recorrido Rahue → Osorno
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[12px] font-medium text-[var(--accent-deep)]">
            <PulseDot />
            En ruta
          </span>
        </div>

        <div className="relative mt-8 h-40">
          <svg viewBox="0 0 280 140" className="h-full w-full" aria-hidden>
            <path
              d={ROUTE_PATH}
              fill="none"
              stroke="var(--line)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="1 14"
            />
            <path
              d={ROUTE_PATH}
              pathLength="100"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              className="route-line"
            />
            <circle cx="10" cy="120" r="4" fill="var(--ink)" />
            <circle cx="270" cy="20" r="4" fill="var(--ink)" />
            <circle
              r="7"
              fill="var(--accent)"
              className="route-dot"
              style={{ offsetPath: `path('${ROUTE_PATH}')` }}
            />
          </svg>
        </div>

        <div className="mt-2 flex items-end justify-between border-t border-[var(--line)] pt-4">
          <div>
            <p className="text-[13px] text-[var(--ink-soft)]">Última ubicación</p>
            <p className="text-[15px] font-medium text-[var(--ink)]">hace 34 segundos</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-[var(--ink-soft)]">Paradero</p>
            <p className="text-[15px] font-medium text-[var(--ink)]">~8 min</p>
          </div>
        </div>
      </div>
    </div>
  )
}
