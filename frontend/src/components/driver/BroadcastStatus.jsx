import { AlertTriangle, Inbox, Satellite } from "lucide-react"
import { useElapsedSince } from "@/hooks/useElapsedSince"
import { FRESHNESS, getFreshness } from "@/lib/freshness"

const hora = (epochMs) =>
  new Date(epochMs).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

const desdeHace = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `hace ${total} s`
  const minutos = Math.floor(total / 60)
  return `hace ${minutos} min ${total % 60} s`
}

/**
 * Los mismos umbrales que ve el pasajero, con las palabras del chofer.
 *
 * No se inventa una escala propia: si el chofer lee "transmitiendo" mientras el
 * pasajero ya lo ve como "sin senal", una de las dos pantallas esta mintiendo.
 * Por eso el estado sale de getFreshness() y solo se cambia la etiqueta.
 */
const DRIVER_LABELS = {
  [FRESHNESS.LIVE]: "Transmitiendo",
  [FRESHNESS.INTERMITTENT]: "Transmisión intermitente",
  [FRESHNESS.NO_SIGNAL]: "Sin señal",
  [FRESHNESS.OUT_OF_SERVICE]: "Sin señal",
}

const NEUTRAL = "#6e6e73"
const ALARM = "#e0430f"

export function BroadcastStatus({
  permission,
  geoError,
  fix,
  lastSuccessStamp,
  everSent,
  pendingCount,
  lastBatchSize,
  failures,
  sendError,
  clockSkew,
}) {
  const elapsedMs = useElapsedSince(lastSuccessStamp)
  const live = getFreshness({ freshness: FRESHNESS.LIVE, ageSeconds: 0 }, elapsedMs)

  // Tres situaciones distintas que nunca se pueden ver iguales: no hay GPS,
  // nunca se logro transmitir, o se transmitia y ahora se corto. La tercera es
  // recuperable sola; la segunda exige que el chofer haga algo.
  let color = live.color
  let label = DRIVER_LABELS[live.status]
  let detail = `Última transmisión ${desdeHace(elapsedMs)}`

  if (permission !== "granted") {
    color = NEUTRAL
    label = "Sin ubicación"
    detail = "El teléfono no está entregando la posición."
  } else if (!everSent && failures === 0) {
    color = NEUTRAL
    label = "Buscando GPS"
    detail = "Esperando la primera posición del teléfono."
  } else if (!everSent) {
    color = ALARM
    label = "Nunca se pudo transmitir"
    detail = "Ningún envío ha llegado al servidor. Los pasajeros no te ven en el mapa."
  }

  const pulsing = permission === "granted" && everSent && live.status === FRESHNESS.LIVE

  return (
    <section
      className="rounded-3xl border-2 bg-white p-5"
      style={{ borderColor: color }}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex size-4 shrink-0">
          {pulsing && (
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: color }}
            />
          )}
          <span
            className="relative inline-flex size-4 rounded-full"
            style={{ backgroundColor: color }}
          />
        </span>
        <h2 className="text-[24px] font-semibold tracking-[-0.01em]" style={{ color }}>
          {label}
        </h2>
      </div>

      <p className="mt-2 text-[17px] text-[var(--ink)]">{detail}</p>

      {/* Un lote grande recuperado es la prueba de que el corte no perdio el
          recorrido: se dice, porque es justo lo que el chofer no puede deducir. */}
      {lastBatchSize > 1 && pendingCount === 0 && (
        <p className="mt-2 text-[15px] text-[var(--ink-soft)]">
          Se recuperaron {lastBatchSize} posiciones guardadas en un solo envío.
        </p>
      )}

      {pendingCount > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--mist)] px-3 py-2.5 text-[15px] text-[var(--ink-soft)]">
          <Inbox className="mt-0.5 size-4 shrink-0" />
          {pendingCount === 1
            ? "1 posición guardada. Se enviará cuando vuelva la señal."
            : `${pendingCount} posiciones guardadas. Se enviarán juntas cuando vuelva la señal.`}
        </p>
      )}

      {sendError && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--accent-deep)]/30 bg-[var(--accent-soft)] px-3 py-2.5 text-[15px] text-[var(--accent-deep)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {sendError}
            {!clockSkew && failures > 1 && ` (${failures} intentos fallidos seguidos)`}
          </span>
        </p>
      )}

      {geoError && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--mist)] px-3 py-2.5 text-[15px] text-[var(--ink-soft)]">
          <Satellite className="mt-0.5 size-4 shrink-0" />
          {geoError}
        </p>
      )}

      {fix && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-[14px]">
          <div>
            <dt className="text-[var(--ink-soft)]">Posición del GPS</dt>
            <dd className="text-[var(--ink)]">
              {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--ink-soft)]">Tomada a las</dt>
            <dd className="text-[var(--ink)]">
              {hora(fix.timestamp)}
              {fix.accuracyMeters != null && ` · ±${fix.accuracyMeters} m`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
