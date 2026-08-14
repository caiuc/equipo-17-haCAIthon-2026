import { Clock, Loader2, MapPin, Users } from "lucide-react"
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
    <section className="border-t border-[var(--line)] py-4">
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
 * Todo lo que sabemos de la micro elegida: ella, su recorrido y su empresa.
 *
 * Vive dentro del bottom sheet y no en un dialogo aparte. Es el patron de Uber
 * completo: la lista sirve para elegir y, elegida una, la hoja DEJA de ser lista
 * y pasa a ser la ficha de esa micro. Asi no hay dos capas encimadas sobre el
 * mapa ni un modal que tape la micro que se acaba de tocar.
 *
 * Lo vivo sigue vivo: `bus` y `elapsedMs` vienen del mismo polling que alimenta
 * el mapa, asi que frescura, distancia y ocupacion se siguen actualizando con la
 * ficha abierta. Congelarlas seria mostrar un dato viejo como si fuera fresco.
 *
 * @param {object} bus            micro en vivo
 * @param {object|null} route     detalle del recorrido (paraderos, horarios, tarifas)
 * @param {object|null} company   ficha publica de la empresa
 * @param {object|null} stop      paradero contra el que se mide la distancia
 * @param {boolean|null} myVote   que voto este dispositivo sobre esta micro
 */
export function MicroDetail({
  bus,
  route,
  routeLoading = false,
  company,
  companyLoading = false,
  stop,
  elapsedMs = 0,
  myVote = null,
  onReportOccupancy,
}) {
  const freshness = getFreshness(bus, elapsedMs)
  const distance = formatDistance(bus.distanceMeters)
  const positionUnreliable = freshness.status === FRESHNESS.NO_SIGNAL
  const stops = route?.stops ?? []

  return (
    <div className="flex flex-col">
      <Section title={stop ? `Distancia a ${stop.name}` : "Distancia"}>
        {distance ? (
          <p className="text-[20px] font-semibold text-[var(--ink)]">A {distance}</p>
        ) : (
          <p className="text-[13px] leading-snug text-[var(--ink-soft)]">
            {positionUnreliable
              ? "No calculamos la distancia: la última posición es muy vieja para sostenerla."
              : "Elige tu paradero para ver a qué distancia viene."}
          </p>
        )}
        <p className="pt-1 text-[11px] leading-snug text-[var(--ink-soft)]">
          Es distancia en línea recta, no por el camino, y no la convertimos a minutos: no
          modelamos el trazado ni las paradas, y un tiempo estimado sobre eso sería falso.
        </p>
      </Section>

      <Section title="¿Va llena?">
        <OccupancyVote
          occupancy={formatOccupancy(bus.occupancy)}
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
    </div>
  )
}
