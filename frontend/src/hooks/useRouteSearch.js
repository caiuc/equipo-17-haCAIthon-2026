import { useEffect, useState } from "react"
import { searchRoutes } from "@/lib/api"

/** Espera antes de consultar: en el celular cada tecla no puede ser una peticion. */
const DEBOUNCE_MS = 300

/**
 * Busca recorridos por nombre o codigo, con filtros opcionales de empresa y
 * zona.
 *
 * Sin filtros el backend devuelve el catalogo completo, asi que la pantalla
 * nunca arranca vacia. Cero resultados es `[]` con 200: no es un error y no se
 * muestra como tal.
 *
 * @param {string} query texto tipeado por el pasajero
 * @param {{ companyIds?: string[], zoneId?: string | null }} filters
 */
export function useRouteSearch(query = "", filters = {}) {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const companyIds = filters.companyIds ?? []
  const zoneId = filters.zoneId ?? null
  // Evita re-disparar el efecto cuando el array de companyIds es un objeto
  // nuevo con el mismo contenido en cada render.
  const companyIdsKey = companyIds.join(",")

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const timer = setTimeout(() => {
      searchRoutes({ q: query.trim(), companyIds, zoneId: zoneId ?? undefined })
        .then((data) => {
          if (cancelled) return
          setRoutes(Array.isArray(data) ? data : [])
          setError(null)
        })
        .catch((err) => {
          if (!cancelled) setError(err)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- companyIds va resumido en companyIdsKey
  }, [query, companyIdsKey, zoneId])

  return { routes, loading, error }
}
