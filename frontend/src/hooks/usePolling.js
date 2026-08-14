import { useCallback, useEffect, useRef, useState } from "react"
import { LIVE_POLL_INTERVAL_MS } from "@equipo17/shared"

/**
 * Consulta repetida de un endpoint en vivo. La comparten useLiveRoute (un
 * recorrido) y useLiveBuses (el mapa completo).
 *
 * Tres decisiones que vienen del terreno rural:
 *
 * 1. `setTimeout` encadenado y NO `setInterval`: con senal mala una consulta
 *    puede tardar mas que el intervalo, y `setInterval` encimaria peticiones
 *    sobre una conexion que ya no da mas. Aqui la siguiente se agenda recien
 *    cuando la anterior termino.
 * 2. Una consulta que falla NO borra lo anterior. Si la senal se corta mientras
 *    el pasajero mira la pantalla, sigue viendo las micros que ya conocia —
 *    envejeciendo con `receivedAt` — en vez de una pantalla en blanco que no
 *    responde "¿viene o no viene?".
 * 3. El polling se pausa con la pestana oculta y se refresca al volver: nadie
 *    deberia gastar datos moviles con la pantalla apagada en un paradero.
 *
 * @param {() => Promise<unknown>} fetcher consulta; debe venir memoizada
 * @param {{enabled?: boolean, resetKey?: unknown, intervalMs?: number}} options
 *   `resetKey` limpia lo mostrado cuando cambia el objeto consultado.
 */
export function usePolling(fetcher, { enabled = true, resetKey = null, intervalMs = LIVE_POLL_INTERVAL_MS } = {}) {
  const [data, setData] = useState(null)
  // Marca monotona (performance.now) de cuando llego la respuesta. Con ella se
  // envejece el dato entre consultas sin comparar nunca el reloj del telefono
  // contra el del servidor.
  const [receivedAt, setReceivedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Descarta respuestas de consultas viejas que llegan tarde y pisarian a las nuevas.
  const requestSeq = useRef(0)

  const refresh = useCallback(() => {
    if (!enabled) return Promise.resolve()

    const seq = ++requestSeq.current
    return fetcher()
      .then((payload) => {
        if (seq !== requestSeq.current) return
        setData(payload)
        setReceivedAt(performance.now())
        setError(null)
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return
        setError(err)
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false)
      })
  }, [fetcher, enabled])

  useEffect(() => {
    // Cambio de objeto consultado: lo anterior ya no describe lo que se mira, y
    // las respuestas en vuelo de la consulta vieja quedan invalidadas.
    requestSeq.current++
    setData(null)
    setReceivedAt(null)
    setError(null)
  }, [resetKey])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let stopped = false
    let timer = null
    let inFlight = false

    const run = () => {
      timer = null
      if (stopped || document.visibilityState !== "visible") return
      inFlight = true
      refresh().finally(() => {
        inFlight = false
        if (!stopped && timer == null) timer = setTimeout(run, intervalMs)
      })
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!inFlight) {
          clearTimeout(timer)
          run()
        }
      } else {
        clearTimeout(timer)
        timer = null
      }
    }

    setLoading(true)
    run()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [enabled, intervalMs, refresh])

  return { data, receivedAt, loading, error, refresh }
}
