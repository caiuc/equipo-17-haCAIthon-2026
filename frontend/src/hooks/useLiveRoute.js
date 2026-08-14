import { useCallback } from "react"
import { getRouteLive } from "@/lib/api"
import { usePolling } from "@/hooks/usePolling"

/**
 * Estado en vivo de un recorrido, consultado cada LIVE_POLL_INTERVAL_MS.
 *
 * El estado de frescura no se calcula aca: llega en `bus.freshness` y
 * `bus.ageSeconds`. `receivedAt` es la marca monotona local para envejecer ese
 * dato entre consultas (ver usePolling).
 *
 * Cambiar de recorrido si invalida lo mostrado; cambiar de paradero no, porque
 * son las mismas micros y solo cambia la distancia.
 *
 * @param {string|null} routeId recorrido elegido
 * @param {string|null} stopId  paradero para el que se pide `distanceMeters`
 */
export function useLiveRoute(routeId, stopId) {
  const fetcher = useCallback(
    () => getRouteLive(routeId, stopId ?? undefined),
    [routeId, stopId],
  )

  const { data, receivedAt, loading, error, refresh } = usePolling(fetcher, {
    enabled: Boolean(routeId),
    resetKey: routeId,
  })

  return { live: data, receivedAt, loading, error, refresh }
}
