import { useEffect, useState } from "react"
import { listCompanies } from "@/lib/api"

/**
 * Fichas de empresa para el filtro del buscador. No bloquea el buscador
 * principal si falla: el filtro es un realce, no una dependencia dura del
 * "¿viene o no viene?".
 */
export function useCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    listCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(Array.isArray(data) ? data : [])
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

  return { companies, loading, error }
}
