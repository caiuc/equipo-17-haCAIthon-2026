import { useCallback, useMemo } from "react"
import { getLiveBuses } from "@/lib/api"
import { usePolling } from "@/hooks/usePolling"

/**
 * Todas las micros vivas del mapa, de todas las empresas, cada
 * LIVE_POLL_INTERVAL_MS. Es la vista del pasajero que todavia no eligio
 * recorrido: primero ve que hay moviendose cerca, despues filtra.
 *
 * `truncated` no se esconde: si el servidor recorto por `limit`, el mapa esta
 * mostrando menos micros de las que hay y eso hay que decirlo, igual que se
 * declara la edad de una posicion.
 *
 * @param {{bbox?: string, companyId?: string, routeId?: string, stopId?: string,
 *          limit?: number, enabled?: boolean}} filters
 */
export function useLiveBuses({ bbox, companyId, routeId, stopId, limit, enabled = true } = {}) {
  const fetcher = useCallback(
    () => getLiveBuses({ bbox, companyId, routeId, stopId, limit }),
    [bbox, companyId, routeId, stopId, limit],
  )

  // Cambiar de empresa o de recorrido cambia el conjunto mostrado; mover el
  // mapa o elegir paradero no, asi que esos no borran lo que ya se ve.
  const resetKey = useMemo(() => `${companyId ?? ""}|${routeId ?? ""}`, [companyId, routeId])

  const { data, receivedAt, loading, error, refresh } = usePolling(fetcher, { enabled, resetKey })

  return {
    buses: data?.buses ?? [],
    serverTime: data?.serverTime ?? null,
    total: data?.total ?? 0,
    truncated: data?.truncated ?? false,
    receivedAt,
    loading,
    error,
    refresh,
  }
}
