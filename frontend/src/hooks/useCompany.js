import { useEffect, useState } from "react"
import { getCompanies } from "@/lib/api"

/**
 * Ficha publica de una empresa a partir de su id.
 *
 * El catalogo completo lo cachea `getCompanies()` en memoria, asi que pasar de
 * una micro a otra no genera trafico: la primera seleccion de la sesion es la
 * unica que pide.
 *
 * El efecto depende de `companyId` a proposito. Si la primera consulta falla
 * (senal rural), la siguiente seleccion la reintenta en vez de dejar la ficha
 * muerta hasta que se recargue la pagina.
 *
 * @param {string|null} companyId empresa de la micro o del recorrido elegido
 */
export function useCompany(companyId) {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!companyId) return
    let cancelled = false

    getCompanies()
      .then((data) => {
        if (cancelled) return
        setCompanies(Array.isArray(data) ? data : [])
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })

    return () => {
      cancelled = true
    }
  }, [companyId])

  const company = companyId ? (companies?.find((item) => item.id === companyId) ?? null) : null

  return { company, loading: Boolean(companyId) && !company && !error, error }
}
