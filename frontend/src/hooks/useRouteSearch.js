import { useEffect, useState } from "react"
import { searchRoutes } from "@/lib/api"

/** Espera antes de consultar: en el celular cada tecla no puede ser una peticion. */
const DEBOUNCE_MS = 300

/**
 * Busca recorridos por nombre o codigo.
 *
 * Sin `query` el backend devuelve el catalogo completo, asi que la pantalla
 * nunca arranca vacia. Cero resultados es `[]` con 200: no es un error y no se
 * muestra como tal.
 *
 * @param {string} query texto tipeado por el pasajero
 */
export function useRouteSearch(query = "") {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const timer = setTimeout(() => {
      searchRoutes(query.trim())
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
  }, [query])

  return { routes, loading, error }
}
