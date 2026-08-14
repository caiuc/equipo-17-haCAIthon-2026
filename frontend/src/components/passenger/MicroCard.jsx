import { Bus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getFreshness } from "@/lib/freshness"

function formatTarifa(tarifa) {
  return tarifa.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
}

export function MicroCard({ micro, selected, onSelect }) {
  const freshness = getFreshness(micro.lastSeenAt, micro.turnoActivo)

  return (
    <button
      type="button"
      onClick={() => onSelect(micro.id)}
      disabled={!micro.turnoActivo}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
        selected
          ? "border-[var(--ink)] bg-white"
          : "border-transparent bg-white hover:border-[var(--line)]"
      } ${!micro.turnoActivo ? "opacity-60" : ""}`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mist)]">
        <Bus className="h-6 w-6 text-[var(--ink)]" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-semibold text-[var(--ink)]">{micro.empresa}</p>
          {micro.turnoActivo && micro.etaMin != null && (
            <Badge className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0 text-[11px] font-medium text-[var(--accent-deep)]">
              {micro.etaMin} min
            </Badge>
          )}
        </div>
        <p className="truncate text-[13px] text-[var(--ink-soft)]">{micro.recorrido}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${freshness.dotClass}`} />
          <span className="truncate text-[12px]" style={{ color: freshness.color }}>
            {freshness.message}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[15px] font-semibold text-[var(--ink)]">{formatTarifa(micro.tarifa)}</p>
        <p className="text-[11px] text-[var(--ink-soft)]">{micro.horario}</p>
      </div>
    </button>
  )
}
