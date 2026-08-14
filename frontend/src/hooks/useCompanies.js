import { useEffect, useState } from "react"
import { getCompanies } from "@/lib/api"

/**
 * Las empresas activas, para el filtro del buscador.
 *
 * `getCompanies` cachea la promesa a nivel de modulo, asi que varios componentes
 * que la pidan comparten una sola peticion en toda la sesion. Son ocho fichas
 * que cambian una vez al mes.
 *
 * Se lista la TOTALIDAD de las empresas, no solo las que estan transmitiendo:
 * si el filtro escondiera a las que ahora mismo no tienen ninguna micro en ruta,
 * escondería justo a la que el pasajero quiere consultar, y no habria forma de
 * preguntar por ella. "Ninguna micro de Islaval esta en ruta" es una respuesta;
 * que Islaval no aparezca en la lista, no.
 *
 * Un fallo aca no bloquea el buscador: el filtro es un realce, no una
 * dependencia dura del "¿viene o no viene?".
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
        setCompanies(Array.isArray(lista) ? lista : [])
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
