import { useState } from "react"
import { assetPath, assetSlugOr, fareFor } from "@equipo17/shared"
import { ChevronDown, ExternalLink, Loader2, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatFare } from "@/lib/fare"

const PASSENGER_LABELS = {
  ADULT: "Adulto",
  STUDENT: "Estudiante",
  SENIOR: "Adulto mayor",
}

/**
 * Fecha en que se consulto la fuente, siempre en UTC.
 *
 * El backend manda medianoche UTC. Formatearla con el huso del telefono (Chile
 * va -3/-4) la correria un dia hacia atras y la ficha diria "consultado el 13"
 * de un dato consultado el 14: exactamente la clase de dato falso que este
 * proyecto no se permite.
 */
const CHECKED_DATE = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const formatCheckedAt = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : CHECKED_DATE.format(date)
}

/** El `tel:` no admite espacios: "+56 2 2812 9177" no marca, "+56228129177" si. */
const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, "")}`

const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Identidad de la empresa: sprite, nombre, tipo de servicio y cuantos
 * recorridos publica. El color es el mismo con el que se pinta su micro en el
 * mapa, asi que se reconoce de quien es la ficha sin leer el nombre.
 */
export function CompanyIdentity({ company, reason = null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${company.color}1a`, border: `2px solid ${company.color}` }}
      >
        <img
          src={assetPath(assetSlugOr(company.assetSlug))}
          alt=""
          width={32}
          height={32}
          draggable={false}
          className="h-8 w-8 select-none object-contain"
        />
      </span>

      <div className="min-w-0 flex-1">
        {reason && <p className="text-[11px] text-[var(--ink-soft)]">{reason}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-semibold text-[var(--ink)]">{company.name}</span>
          {company.kind === "MUNICIPAL" && (
            <Badge className="bg-[var(--mist)] text-[11px] font-medium text-[var(--ink-soft)]">
              Servicio municipal
            </Badge>
          )}
        </div>
        <p className="text-[12px] text-[var(--ink-soft)]">
          {company.routeCount === 1
            ? "Publica 1 recorrido"
            : `Publica ${company.routeCount} recorridos`}
        </p>
      </div>
    </div>
  )
}

/**
 * Tarifas por tipo de pasajero, con los tres casos: monto, "Gratis" cuando es 0
 * y "Tarifa por confirmar" cuando la empresa no la publica. Cuatro de las ocho
 * empresas sembradas no publican tarifa, asi que el tercer caso es el frecuente
 * y no la excepcion: por eso los tres tipos van siempre, cada uno diciendo lo
 * que se sabe de el, en vez de esconder los que faltan.
 */
export function FareRow({ fares = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["ADULT", "STUDENT", "SENIOR"].map((type) => {
        const fare = formatFare(fareFor(fares, type))

        return (
          <span
            key={type}
            className={`rounded-full px-2.5 py-1 text-[12px] ${
              fare.tone === "unknown"
                ? "bg-[var(--mist)] text-[var(--ink-soft)]"
                : "bg-[var(--mist)] text-[var(--ink)]"
            }`}
          >
            {PASSENGER_LABELS[type]}{" "}
            <span className={fare.tone === "unknown" ? "" : "font-semibold"}>{fare.label}</span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * Telefono y sitio de la empresa.
 *
 * El telefono no es un adorno: es la salida cuando no hay ninguna micro
 * transmitiendo. "Llamalos" responde mejor que una pantalla vacia, asi que va
 * como accion principal. Cuando no hay telefono se dice que no lo hay — una fila
 * vacia o un guion se leerian como "no contesta".
 */
export function CompanyContact({ company }) {
  return (
    <div className="flex flex-col gap-3">
      {company.phone ? (
        <a
          href={telHref(company.phone)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white"
          style={{ backgroundColor: company.color }}
        >
          <Phone className="h-4 w-4" strokeWidth={2} />
          Llamar a {company.name}
        </a>
      ) : (
        <p className="text-[12px] text-[var(--ink-soft)]">
          Esta empresa no publica un teléfono de contacto.
        </p>
      )}

      {company.website && (
        <a
          href={company.website}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 text-[13px] text-[var(--ink)] underline underline-offset-2"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          {hostOf(company.website)}
        </a>
      )}
    </div>
  )
}

/**
 * De donde salio la ficha y cuando se consulto.
 *
 * El principio rector no aplica solo a las posiciones: una tarifa sin fecha se
 * lee como vigente aunque tenga anos. Si no sabemos cuando se consulto, se dice.
 */
export function CompanySource({ company }) {
  const checkedAt = company.sourceCheckedAt ? formatCheckedAt(company.sourceCheckedAt) : null

  return (
    <p className="text-[11px] leading-snug text-[var(--ink-soft)]">
      {checkedAt ? `Datos consultados el ${checkedAt}` : "No sabemos cuándo se consultaron estos datos"}
      {company.sourceUrl && (
        <>
          {" · "}
          <a
            href={company.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            ver fuente
          </a>
        </>
      )}
    </p>
  )
}

/**
 * Ficha compacta y plegable de la empresa, para el bottom sheet.
 *
 * Aparece cuando hay un recorrido elegido y ninguna micro que tocar — que es
 * justo cuando el telefono de la empresa pasa a ser la unica respuesta util que
 * podemos dar. Cuando si hay micros, el detalle completo vive en el modal de la
 * micro y esta tarjeta no compite con la lista.
 */
export function CompanyCard({ company, fares = [], loading = false, reason = null }) {
  const [open, setOpen] = useState(true)

  if (loading) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3.5 py-3 text-[13px] text-[var(--ink-soft)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando ficha de la empresa…
      </div>
    )
  }

  if (!company) return null

  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <CompanyIdentity company={company} reason={reason} />
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--ink-soft)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[var(--line)] px-3.5 py-3">
          <FareRow fares={fares} />
          <CompanyContact company={company} />
          <CompanySource company={company} />
        </div>
      )}
    </section>
  )
}
