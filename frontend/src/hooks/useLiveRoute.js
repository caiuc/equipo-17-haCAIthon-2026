import { useCallback, useEffect, useRef, useState } from "react"
import { getRouteLive } from "@/lib/api"
import { LIVE_POLL_INTERVAL_MS } from "@equipo17/shared"

/**
 * Estado en vivo de un recorrido, consultado cada LIVE_POLL_INTERVAL_MS.
 *
 * Dos decisiones que vienen del terreno rural:
 *
 * 1. Una consulta que falla NO borra lo anterior. Si la senal se corta mientras
 *    el pasajero mira la pantalla, sigue viendo las micros que ya conocia con su
 *    frescura declarada (que envejece sola en el servidor) en vez de una
 *    pantalla en blanco que no responde "¿viene o no viene?".
 * 2. El polling se pausa con la pestana oculta y se refresca al volver: nadie
 *    deberia gastar datos moviles con la pantalla apagada en un paradero.
 *
 * El estado de frescura no se calcula aca: llega en `bus.freshness` y
 * `bus.ageSeconds`, y `serverTime` es el reloj de referencia.
 *
 * @param {string|null} routeId recorrido elegido
 * @param {string|null} stopId  paradero para el que se pide `distanceMeters`
 */
export function useLiveRoute(routeId, stopId) {
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Descarta respuestas de consultas viejas que llegan tarde y pisarian a las nuevas.
  const requestSeq = useRef(0)

  const refresh = useCallback(() => {
    if (!routeId) return Promise.resolve()

    const seq = ++requestSeq.current
    return getRouteLive(routeId, stopId ?? undefined)
      .then((data) => {
        if (seq !== requestSeq.current) return
        setLive(data)
        setError(null)
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return
        setError(err)
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false)
      })
  }, [routeId, stopId])

  // Cambiar de recorrido si invalida lo mostrado; cambiar de paradero no, porque
  // son las mismas micros y solo cambia la distancia.
  useEffect(() => {
    setLive(null)
    setError(null)
  }, [routeId])

  useEffect(() => {
    if (!routeId) {
      setLoading(false)
      return
    }

    setLoading(true)
    refresh()

    let timer = null
    const startPolling = () => {
      if (timer == null) timer = setInterval(refresh, LIVE_POLL_INTERVAL_MS)
    }
    const stopPolling = () => {
      if (timer != null) {
        clearInterval(timer)
        timer = null
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh()
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (document.visibilityState === "visible") startPolling()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [routeId, stopId, refresh])

  return { live, loading, error, refresh }
}
