import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ErrorNotice, Modal } from "@/components/company/Primitives"

/**
 * Terminar turno pide confirmacion a proposito.
 *
 * Es la unica accion irreversible de esta pantalla: apretarla sin querer saca la
 * micro del mapa de todos los pasajeros que la estan esperando, y volver a
 * iniciar turno abre un viaje nuevo, no recupera el anterior.
 */
export function EndShiftButton({ onEnd }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const end = async () => {
    setBusy(true)
    setError(null)
    try {
      await onEnd()
      setConfirming(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
        className="h-16 w-full rounded-2xl border-2 border-[var(--line)] text-[18px] font-semibold text-[var(--ink)]"
      >
        Terminar turno
      </Button>

      {confirming && (
        <Modal title="¿Terminar el turno?" onClose={() => setConfirming(false)}>
          <p className="text-[16px] text-[var(--ink)]">
            Tu micro deja de aparecer en el mapa de los pasajeros y dejas de transmitir. Si te queda
            recorrido por hacer, cancela.
          </p>

          <div className="mt-4">
            <ErrorNotice>{error}</ErrorNotice>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <Button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-14 w-full rounded-2xl bg-[var(--ink)] text-[17px] font-semibold text-white"
            >
              Seguir en ruta
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={end}
              disabled={busy}
              className="h-14 w-full rounded-2xl border-2 border-[var(--accent-deep)] text-[17px] font-semibold text-[var(--accent-deep)]"
            >
              {busy ? "Terminando…" : "Sí, terminar turno"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
