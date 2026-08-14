import { ChevronRight, Users } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { BusSprite } from "@/components/passenger/BusSprite"
import { OccupancyVote } from "@/components/passenger/OccupancyVote"
import { formatFare } from "@/lib/fare"
import { FRESHNESS, formatDistance, formatOccupancy, getFreshness } from "@/lib/freshness"

/**
 * Aqui NO va un ETA en minutos. No modelamos subida de pasajeros, paradas a la
 * sena ni el trazado real del camino: un ETA sobre eso estaria malo, y un ETA
 * malo genera confianza falsa. Va la distancia en linea recta, o nada cuando el
 * backend no la entrega — que es justo cuando la posicion ya no la sostiene.
 */
function DistanceLine({ distanceMeters, unreliable }) {
  const distance = formatDistance(distanceMeters)
  if (distance) return <span className="text-[13px] text-[var(--ink)]">A {distance}</span>

  if (unreliable) {
    return (
      <span className="text-[12px] text-[var(--ink-soft)]">
        Sin distancia: la última posición es muy vieja
      </span>
    )
  }
  return <span className="text-[12px] text-[var(--ink-soft)]">Elige tu paradero para la distancia</span>
}

/**
 * Una micro en la lista: lo justo para decidir. El detalle completo — empresa,
 * horarios, tarifas por tipo de pasajero, procedencia del dato — se abre al
 * tocarla, en `MicroDetailSheet`. Meterlo todo en la tarjeta convertiria la
 * lista en algo imposible de barrer con el pulgar.
 */
export function MicroCard({
  ref,
  bus,
  selected,
  onSelect,
  onReportOccupancy,
  myVote,
  elapsedMs = 0,
  showVote = true,
}) {
  const freshness = getFreshness(bus, elapsedMs)
  const fare = formatFare(bus.fareAdultClp)
  // Sin señal significa que la posición ya no sostiene una distancia: no se
  // estima nada, se declara la incertidumbre.
  const positionUnreliable = freshness.status === FRESHNESS.NO_SIGNAL

  return (
    /*
     * El verde de "seleccionada" NO puede ser el verde de "En vivo" (#1fae5f).
     * Son dos cosas distintas y el mapa ya usa color para la empresa: si la
     * seleccion se pintara con el mismo verde, una micro SIN SENAL seleccionada
     * se leeria como si estuviera transmitiendo. Por eso la seleccion es fondo
     * verde muy palido con borde verde oscuro — un tono que no aparece en ningun
     * estado de frescura — y la frescura sigue viviendo en su punto y su texto,
     * que no cambian de color al seleccionar.
     */
    <div
      ref={ref}
      aria-current={selected ? "true" : undefined}
      className={`rounded-2xl border-2 transition-colors ${
        selected
          ? "border-[#0f6b41] bg-[#f0faf4] shadow-sm"
          : "border-[var(--line)] bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(bus.tripId)}
        className="flex w-full flex-col gap-2 px-3.5 py-3 text-left"
        aria-label={`Ver detalle de ${bus.routeCode}, ${bus.company.name}`}
      >
        <div className="flex items-center gap-3">
          {/* En la lista el rumbo no aporta: el sprite va derecho. */}
          <BusSprite
            assetSlug={bus.company.assetSlug}
            status={freshness.status}
            statusLabel={freshness.label}
            size={44}
            rotate={false}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="shrink-0 text-[15px] font-semibold text-[var(--ink)]">
                {bus.routeCode}
              </span>
              <span className="truncate text-[13px] text-[var(--ink-soft)]">
                {bus.company.name}
              </span>
            </div>
            <p className="truncate text-[12px] text-[var(--ink-soft)]">{bus.routeName}</p>
            {bus.seats != null && (
              <span className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--ink-soft)]">
                <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                {bus.seats} asientos
              </span>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p
              className={
                fare.tone === "unknown"
                  ? "text-[12px] text-[var(--ink-soft)]"
                  : "text-[15px] font-semibold text-[var(--ink)]"
              }
            >
              {fare.label}
            </p>
            <DistanceLine distanceMeters={bus.distanceMeters} unreliable={positionUnreliable} />
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-soft)]" strokeWidth={2} />
        </div>

        {/* Nunca un dato sin decir que tan viejo es: el chip y su texto. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--mist)] px-2 py-0.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${freshness.dotClass}`} />
            <span className="text-[12px] font-medium" style={{ color: freshness.color }}>
              {freshness.label}
            </span>
          </span>
          <span className="text-[12px] text-[var(--ink-soft)]">{freshness.message}</span>
        </div>
      </button>

      {/* Con la ficha abierta los botones de ocupacion ya viven en su seccion:
          repetirlos aca dejaria dos pares de botones que hacen lo mismo. */}
      {showVote && (
        <>
          <Separator className="bg-[var(--line)]" />
          <div className="px-3.5 py-2.5">
            <OccupancyVote
              occupancy={formatOccupancy(bus.occupancy)}
              tripId={bus.tripId}
              myVote={myVote}
              onReportOccupancy={onReportOccupancy}
            />
          </div>
        </>
      )}
    </div>
  )
}
