import { Crosshair, Loader2, LocateFixed, LocateOff } from "lucide-react"

/**
 * Boton "mi ubicacion".
 *
 * El permiso de geolocalizacion se pide AQUI y no al cargar la pagina. Un
 * dialogo que salta a los dos segundos de abrir un sitio desconocido se deniega
 * casi siempre, y el navegador recuerda esa negativa: quemarlo deja la app peor
 * para siempre y solo se recupera entrando a la configuracion del navegador.
 * Detras de un toque explicito, el permiso llega cuando la persona ya sabe para
 * que lo esta dando — que es ademas lo que hacen Uber y Google Maps.
 *
 * @param {string} status idle | locating | tracking | denied | error | unsupported
 */
export function LocateButton({ status, accuracy = null, onRequest }) {
  const denied = status === "denied"
  const unsupported = status === "unsupported"
  const locating = status === "locating"
  const tracking = status === "tracking"

  const label = denied
    ? "Ubicación bloqueada"
    : unsupported
      ? "Este navegador no entrega tu ubicación"
      : tracking
        ? "Centrar en mi ubicación"
        : "Mostrar mi ubicación"

  return (
    <div
      // Se apoya sobre el borde superior de la hoja de micros, que publica su
      // alto visible en `--sheet-visible`. Anclado al fondo quedaria tapado por
      // ella justo cuando el pasajero quiere ubicarse.
      style={{ bottom: "calc(var(--sheet-visible, 45svh) + 12px)" }}
      className="pointer-events-none absolute right-4 z-20 flex flex-col items-end gap-2"
    >
      {/* Un permiso denegado no se deja como un boton que no hace nada: se dice
          que pasó y donde se arregla. */}
      {denied && (
        <p className="pointer-events-auto max-w-[15rem] rounded-2xl bg-white px-3 py-2 text-[12px] leading-snug text-[var(--ink-soft)] shadow-md">
          Bloqueaste la ubicación para este sitio. Se reactiva desde el candado de la barra de
          direcciones del navegador.
        </p>
      )}

      {/* La precision se declara siempre que sea mala: "estas por aca, con 800 m
          de error" es honesto; un punto sin mas seria falsa precision. */}
      {tracking && accuracy != null && accuracy > 100 && (
        <p className="pointer-events-auto rounded-full bg-white px-3 py-1 text-[11px] text-[var(--ink-soft)] shadow-md">
          Tu ubicación tiene ±{Math.round(accuracy)} m de error
        </p>
      )}

      <button
        type="button"
        onClick={onRequest}
        disabled={unsupported}
        aria-label={label}
        title={label}
        className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md disabled:opacity-50 ${
          tracking ? "text-[#1a73e8]" : "text-[var(--ink)]"
        }`}
      >
        {locating ? (
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
        ) : denied || unsupported ? (
          <LocateOff className="h-5 w-5" strokeWidth={1.75} />
        ) : tracking ? (
          <LocateFixed className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <Crosshair className="h-5 w-5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  )
}
