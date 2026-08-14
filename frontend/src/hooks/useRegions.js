import { useEffect, useState } from "react"
import { listRegions } from "@/lib/api"

/**
 * Arbol region -> zonas para los selectores encadenados del filtro. No
 * bloquea el buscador principal si falla, mismo criterio que useCompanies.
 */
export function useRegions() {
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    listRegions()
      .then((data) => {
        if (!cancelled) setRegions(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { regions, loading, error }
}
