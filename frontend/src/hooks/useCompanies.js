import { useEffect, useState } from "react"
import { getCompanies } from "@/lib/api"

/**
 * Las empresas activas, para el filtro del buscador.
 *
 * `getCompanies` ya cachea la promesa a nivel de modulo, asi que varios
 * componentes que lo pidan comparten una sola peticion en toda la sesion.
 *
 * A diferencia de `useCompany`, que resuelve UNA empresa por id, aca interesa la
 * lista completa: el filtro tiene que ofrecer tambien las empresas que en este
 * momento no tienen ninguna micro en ruta — si solo se listaran las que estan
 * transmitiendo, el filtro escondería justo a la empresa que el pasajero quiere
 * consultar y no habria forma de preguntar por ella.
 */
export function useCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true

    getCompanies()
      .then((lista) => {
        if (!vigente) return
        setCompanies(lista)
        setError(null)
      })
      .catch((err) => {
        if (vigente) setError(err)
      })
      .finally(() => {
        if (vigente) setLoading(false)
      })

    return () => {
      vigente = false
    }
  }, [])

  return { companies, loading, error }
}
