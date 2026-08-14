import { Smartphone } from "lucide-react"

/**
 * Limitacion real del prototipo, dicha en la pantalla y no en la documentacion.
 *
 * Una pagina web deja de correr sus temporizadores cuando el navegador pasa a
 * segundo plano o la pantalla se apaga: la micro deja de transmitir y el chofer
 * no tiene como enterarse. Esconderlo seria dejarlo creyendo que transmite,
 * exactamente lo que este proyecto se propone no hacer.
 */
export function ForegroundWarning({ screenLocked }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--mist)] p-4">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-[var(--ink-soft)]" />
        <div>
          <h3 className="text-[16px] font-semibold text-[var(--ink)]">
            Deja esta pantalla encendida y a la vista
          </h3>
          <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
            La transmisión solo funciona con esta página abierta al frente. Si bloqueas el teléfono o
            cambias de aplicación, se corta y los pasajeros dejan de verte.
          </p>
          <p className="mt-1.5 text-[14px] text-[var(--ink-soft)]">
            {screenLocked
              ? "Este navegador está manteniendo la pantalla encendida mientras dure el turno."
              : "Este navegador no puede mantener la pantalla encendida: desactiva el bloqueo automático en los ajustes del teléfono."}
          </p>
        </div>
      </div>
    </section>
  )
}
