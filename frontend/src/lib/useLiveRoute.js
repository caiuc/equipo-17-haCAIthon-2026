import { useEffect, useRef, useState } from "react"
import { getRouteLive } from "@/lib/api"

const LIVE_POLL_INTERVAL_MS = 5000

/**
 * Poll GET /routes/{id}/live cada 5s (§LIVE_POLL_INTERVAL_MS del contrato).
 * Sin WebSockets: un poll que falla simplemente se reintenta en el siguiente tick.
 */
export function useLiveRoute(routeId, stopId) {
  const [live, setLive] = useState(null)
  const [error, setError] = useState(null)
  const stopIdRef = useRef(stopId)
  stopIdRef.current = stopId

  useEffect(() => {
    if (!routeId) return

    let cancelled = false

    async function poll() {
      try {
        const data = await getRouteLive(routeId, stopIdRef.current)
        if (!cancelled) {
          setLive(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err)
      }
    }

    poll()
    const intervalId = setInterval(poll, LIVE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [routeId, stopId])

  return { live, error }
}
