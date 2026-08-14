import { useCallback, useEffect, useState } from "react"
import { driver } from "@/lib/api"

/**
 * El turno del chofer: que recorridos puede tomar, cual esta abierto y como se
 * abre o se cierra.
 *
 * Dos reglas que vienen del backend y no se pueden ignorar:
 *
 * 1. Un chofer tiene UN turno a la vez. Al montar se consulta `/trips/active`,
 *    asi que recargar la pagina (o que se muera la pestana en el bolsillo) no
 *    obliga a abrir otro turno: se retoma el que ya estaba.
 * 2. `start` responde 409 con el turno abierto en `details.trip`. Ese 409 no es
 *    un error que mostrar sino la respuesta correcta a "quiero transmitir": se
 *    adopta el turno y se sigue. Mostrarle un error rojo al chofer cuando SI
 *    tiene turno abierto seria decirle que no esta transmitiendo cuando si.
 */
export function useDriverShift({ enabled, onAuthError }) {
  const [routes, setRoutes] = useState(null)
  const [trip, setTrip] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(null)

  const handleError = useCallback(
    (err) => {
      if (err?.status === 401) {
        onAuthError?.()
        return
      }
      setError(err?.message ?? "No se pudo contactar al servidor")
    },
    [onAuthError]
  )

  useEffect(() => {
    if (!enabled) {
      setChecking(false)
      return
    }
    let cancelled = false

    setChecking(true)
    Promise.all([driver.listRoutes(), driver.activeTrip()])
      .then(([routesData, tripData]) => {
        if (cancelled) return
        setRoutes(routesData.routes)
        setTrip(tripData.trip)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) handleError(err)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, handleError])

  const startShift = useCallback(
    async (routeId) => {
      setError(null)
      try {
        const data = await driver.startTrip(routeId)
        setTrip(data.trip)
      } catch (err) {
        // 409 = ya habia un turno abierto. Se adopta en vez de tratarlo como fallo.
        const existing = err?.status === 409 ? err.details?.trip : null
        if (existing) {
          setTrip(existing)
          return
        }
        handleError(err)
        throw err
      }
    },
    [handleError]
  )

  const endShift = useCallback(async () => {
    if (!trip) return
    setError(null)
    try {
      await driver.endTrip(trip.id)
      setTrip(null)
    } catch (err) {
      // Si el turno ya estaba cerrado (409) o no existe (404), el estado real es
      // "sin turno": insistir dejaria al chofer mirando una pantalla que miente.
      if (err?.status === 409 || err?.status === 404) {
        setTrip(null)
        return
      }
      handleError(err)
      throw err
    }
  }, [trip, handleError])

  /** El turno se cerro solo o desde otro dispositivo: hay que dejar de transmitir. */
  const forgetShift = useCallback(() => setTrip(null), [])

  return { routes, trip, checking, error, startShift, endShift, forgetShift }
}
