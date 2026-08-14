import { useEffect, useState } from "react"
import { getRoute } from "@/lib/api"

/**
 * Detalle de un recorrido, cacheado en memoria por id.
 *
 * Lo que trae — paraderos, horarios, tarifas, trazado — es catalogo: cambia
 * cuando la empresa edita su recorrido, no cada cinco segundos. Abrir el detalle
 * de tres micros del mismo recorrido no puede costar tres descargas de una
 * polilinea de 6 KB en una conexion rural.
 *
 * Lo que si es fresco (posicion, frescura, ocupacion) NO pasa por aca: eso viene
 * del polling en vivo y nunca se cachea.
 */
const cache = new Map()

const fetchRoute = (routeId) => {
  if (!cache.has(routeId)) {
    cache.set(
      routeId,
      getRoute(routeId).catch((err) => {
        // Un fallo no se guarda: la proxima apertura vuelve a intentar.
        cache.delete(routeId)
        throw err
      }),
    )
  }
  return cache.get(routeId)
}

export function useRouteDetail(routeId) {
  const [route, setRoute] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!routeId) {
      setRoute(null)
      return
    }

    let cancelled = false
    setError(null)

    fetchRoute(routeId)
      .then((detail) => {
        if (!cancelled) setRoute(detail)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })

    return () => {
      cancelled = true
    }
  }, [routeId])

  const matches = route?.id === routeId

  return {
    route: matches ? route : null,
    loading: Boolean(routeId) && !matches && !error,
    error,
  }
}
