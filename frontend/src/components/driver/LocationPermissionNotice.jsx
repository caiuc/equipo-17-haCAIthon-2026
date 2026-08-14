import { MapPinOff } from "lucide-react"

/**
 * Permiso de ubicacion negado o navegador sin soporte.
 *
 * No alcanza con dejar el indicador apagado: sin esto el chofer ve una pantalla
 * quieta y no sabe si el problema es la senal, el servidor o el. Se dice que
 * pasa y que hacer, con el paso concreto de cada navegador.
 */
export function LocationPermissionNotice({ permission }) {
  if (permission === "granted" || permission === "prompt") return null

  const unsupported = permission === "unsupported"

  return (
    <section className="rounded-3xl border-2 border-[var(--accent-deep)] bg-[var(--accent-soft)] p-5">
      <div className="flex items-center gap-3">
        <MapPinOff className="size-6 shrink-0 text-[var(--accent-deep)]" />
        <h2 className="text-[20px] font-semibold text-[var(--accent-deep)]">
          {unsupported ? "Este navegador no entrega ubicación" : "Bloqueaste la ubicación"}
        </h2>
      </div>

      <p className="mt-3 text-[16px] text-[var(--ink)]">
        {unsupported
          ? "Sin acceso al GPS no se puede transmitir. Abre esta página en Chrome o Safari desde el teléfono."
          : "Sin permiso de ubicación no se envía nada y los pasajeros no te ven en el mapa, aunque el turno esté iniciado."}
      </p>

      {!unsupported && (
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-[15px] text-[var(--ink)]">
          <li>Toca el candado (o el ícono de ajustes) a la izquierda de la dirección web.</li>
          <li>Entra a Permisos y cambia Ubicación a “Permitir”.</li>
          <li>Recarga esta página. El turno sigue abierto, se retoma solo.</li>
        </ol>
      )}
    </section>
  )
}
