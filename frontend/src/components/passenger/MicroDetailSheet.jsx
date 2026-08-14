import { assetPath, assetSlugOr } from "@equipo17/shared"
import { Check, Clock, Loader2, MapPin, Users } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import {
  CompanyContact,
  CompanyIdentity,
  CompanySource,
  FareRow,
} from "@/components/passenger/CompanyCard"
import { OccupancyVote } from "@/components/passenger/OccupancyVote"
import { FRESHNESS, formatDistance, formatOccupancy, getFreshness } from "@/lib/freshness"

const DAY_LABELS = {
  WEEKDAY: "Lunes a viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo y festivos",
}

function Section({ title, children }) {
  return (
    <section className="border-t border-[var(--line)] px-4 py-4">
      <h3 className="pb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Horarios que publica la empresa. Cuando no publica ninguno se dice — MuniBus
 * Paine no los publica, y dejar el hueco en blanco haria pensar que la micro no
 * sale nunca en vez de que no sabemos a que hora sale.
 */
function Schedules({ schedules = [] }) {
  if (!schedules.length) {
    return (
      <p className="text-[13px] text-[var(--ink-soft)]">
        Horario por confirmar — esta empresa no publica horarios.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {schedules.map((schedule) => (
        <li key={schedule.dayType} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {DAY_LABELS[schedule.dayType] ?? schedule.dayType}
          </span>
          <span className="text-[13px] font-medium text-[var(--ink)]">
            {schedule.firstDeparture} – {schedule.lastDeparture}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Detalle completo de una micro: la micro, su recorrido y su empresa.
 *
 * Es el patron de Uber llevado entero: la lista da lo justo para decidir y el
 * detalle se abre al tocar. Va como hoja que sube desde abajo y no como dialogo
 * centrado porque el caso real es un telefono en un paradero, y porque es el
 * mismo gesto que la hoja de micros que ya esta debajo.
 *
 * Lo vivo sigue vivo con el modal abierto: `bus` y `elapsedMs` llegan del mismo
 * polling que alimenta el mapa, asi que la frescura y la distancia se siguen
 * actualizando. Un modal que congela el dato seria exactamente lo que el
 * principio rector prohibe.
 *
 * @param {object|null} bus       micro en vivo; null cierra la hoja
 * @param {object|null} route     detalle del recorrido (paraderos, horarios)
 * @param {object|null} company   ficha publica de la empresa
 * @param {object|null} stop      paradero contra el que se mide la distancia
 * @param {boolean|null} myVote   que voto este dispositivo sobre esta micro
 */
export function MicroDetailSheet({
  bus,
  route,
  routeLoading = false,
  company,
  companyLoading = false,
  stop,
  elapsedMs = 0,
  myVote = null,
  onReportOccupancy,
  onClose,
}) {
  if (!bus) return null

  const freshness = getFreshness(bus, elapsedMs)
  const occupancy = formatOccupancy(bus.occupancy)
  const distance = formatDistance(bus.distanceMeters)
  const positionUnreliable = freshness.status === FRESHNESS.NO_SIGNAL
  const stops = route?.stops ?? []

  return (
    <Sheet open onOpenChange={(open) => !open && onClose?.()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92svh] gap-0 overflow-y-auto overscroll-contain rounded-t-3xl border-[var(--line)] bg-white p-0"
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 bg-white/95 px-4 pt-5 pb-3 backdrop-blur-xl">
          <img
            src={assetPath(assetSlugOr(bus.company.assetSlug))}
            alt=""
            width={48}
            height={48}
            draggable={false}
            className="h-12 w-12 shrink-0 select-none object-contain"
          />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-[18px] font-semibold leading-tight text-[var(--ink)]">
              {bus.routeCode} · {bus.routeName}
            </SheetTitle>
            <SheetDescription className="text-[13px] text-[var(--ink-soft)]">
              {route ? `${route.originName} → ${route.destinationName}` : bus.company.name}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-[var(--mist)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)]"
          >
            Cerrar
          </button>
        </header>

        {/* Nunca un dato posicional sin decir que tan viejo es. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-4">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--mist)] px-2 py-0.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${freshness.dotClass}`} />
            <span className="text-[12px] font-medium" style={{ color: freshness.color }}>
              {freshness.label}
            </span>
          </span>
          <span className="text-[12px] text-[var(--ink-soft)]">{freshness.message}</span>
        </div>

        <Section title={stop ? `Distancia a ${stop.name}` : "Distancia"}>
          {distance ? (
            <p className="text-[20px] font-semibold text-[var(--ink)]">A {distance}</p>
          ) : (
            <p className="text-[13px] leading-snug text-[var(--ink-soft)]">
              {positionUnreliable
                ? "No calculamos la distancia: la última posición es muy vieja para sostenerla."
                : "Elige tu paradero en la lista para ver a qué distancia viene."}
            </p>
          )}
          <p className="pt-1 text-[11px] leading-snug text-[var(--ink-soft)]">
            Es distancia en línea recta, no por el camino, y no la convertimos a minutos: no
            modelamos el trazado ni las paradas, y un tiempo estimado sobre eso sería falso.
          </p>
        </Section>

        <Section title="¿Va llena?">
          <OccupancyVote
            occupancy={occupancy}
            tripId={bus.tripId}
            myVote={myVote}
            onReportOccupancy={onReportOccupancy}
          />
        </Section>

        {(bus.plate || bus.seats != null || bus.driverName) && (
          <Section title="El vehículo">
            <dl className="flex flex-col gap-1.5 text-[13px]">
              {/* Las filas sin dato no se muestran: un guion se leeria como un valor. */}
              {bus.plate && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--ink-soft)]">Patente</dt>
                  <dd className="font-medium text-[var(--ink)]">{bus.plate}</dd>
                </div>
              )}
              {bus.seats != null && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-[var(--ink-soft)]">
                    <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Asientos
                  </dt>
                  <dd className="font-medium text-[var(--ink)]">{bus.seats}</dd>
                </div>
              )}
              {bus.driverName && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--ink-soft)]">Conduce</dt>
                  <dd className="font-medium text-[var(--ink)]">{bus.driverName}</dd>
                </div>
              )}
            </dl>
          </Section>
        )}

        <Section title="El recorrido">
          {routeLoading && !route ? (
            <p className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando el recorrido…
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {stops.length > 0 && (
                <p className="flex items-start gap-1.5 text-[13px] text-[var(--ink-soft)]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  <span>
                    {stops.length} paraderos, de{" "}
                    <span className="font-medium text-[var(--ink)]">{stops[0].name}</span> a{" "}
                    <span className="font-medium text-[var(--ink)]">
                      {stops[stops.length - 1].name}
                    </span>
                  </span>
                </p>
              )}
              <Schedules schedules={route?.schedules} />
              <FareRow fares={route?.fares} />
            </div>
          )}
        </Section>

        <Section title="La empresa">
          {companyLoading && !company ? (
            <p className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando la ficha…
            </p>
          ) : company ? (
            <div className="flex flex-col gap-3">
              <CompanyIdentity company={company} />
              <CompanyContact company={company} />
              <CompanySource company={company} />
            </div>
          ) : (
            <p className="text-[13px] text-[var(--ink-soft)]">
              No pudimos cargar la ficha de {bus.company.name}.
            </p>
          )}
        </Section>

        <div className="flex items-center gap-2 px-4 pb-8 pt-2 text-[11px] text-[var(--ink-soft)]">
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Esta información se sigue actualizando mientras la tengas abierta.
        </div>
      </SheetContent>
    </Sheet>
  )
}
