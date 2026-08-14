import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Ubicacion del pasajero, siempre a peticion suya.
 *
 * NO se pide el permiso al montar. Un dialogo de ubicacion que aparece a los dos
 * segundos de abrir una pagina desconocida se deniega casi siempre, y el
 * navegador RECUERDA esa negativa: un permiso quemado asi deja la app peor para
 * siempre, y recuperarlo exige que la persona entre a la configuracion del
 * navegador. Por eso el permiso vive detras de un boton explicito, que es
 * ademas lo que hacen Uber y Google Maps.
 *
 * Estados posibles:
 *   idle      nunca se pidio
 *   locating  se pidio y todavia no llega la primera lectura
 *   tracking  hay posicion
 *   denied    la persona (o la politica del navegador) dijo que no
 *   error     falla del GPS: sin senal, timeout
 *   unsupported  el navegador no tiene geolocalizacion
 */
const OPTIONS = {
  // Alta precision porque la pregunta es "cual es MI paradero", y a 500 m de
  // error el paradero de al lado ya es otro.
  enableHighAccuracy: true,
  timeout: 15_000,
  // Una lectura de hace medio minuto sirve para arrancar sin esperar al GPS.
  maximumAge: 30_000,
}

export function useUserLocation() {
  const [status, setStatus] = useState(() =>
    typeof navigator !== "undefined" && navigator.geolocation ? "idle" : "unsupported",
  )
  const [position, setPosition] = useState(null)
  const watchId = useRef(null)
  // Sobrevive a los cortes del watcher: mientras la pestana esta oculta se
  // suelta el GPS, y al volver hay que re-suscribir sin volver a preguntar.
  const wanted = useRef(false)

  const stopWatching = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const startWatching = useCallback(() => {
    if (watchId.current != null) return

    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({
          lat: coords.latitude,
          lng: coords.longitude,
          // El error declarado por el navegador. Se guarda y se muestra: un
          // punto solido con 800 m de incertidumbre es la misma mentira que una
          // posicion vieja presentada como fresca.
          accuracy: coords.accuracy ?? null,
        })
        setStatus("tracking")
      },
      (err) => {
        // 1 = PERMISSION_DENIED. Se distingue del resto porque es el unico que
        // no se arregla esperando: hay que ir a la configuracion del navegador.
        setStatus(err.code === 1 ? "denied" : "error")
        wanted.current = false
        stopWatching()
      },
      OPTIONS,
    )
  }, [stopWatching])

  const request = useCallback(() => {
    if (status === "unsupported") return
    wanted.current = true
    setStatus((current) => (current === "tracking" ? current : "locating"))
    startWatching()
  }, [status, startWatching])

  const clear = useCallback(() => {
    wanted.current = false
    stopWatching()
    setPosition(null)
    setStatus("idle")
  }, [stopWatching])

  // `enableHighAccuracy` mantiene el GPS despierto y se come la bateria. Con la
  // pantalla apagada o la pestana en segundo plano nadie esta mirando el mapa,
  // asi que se suelta y se retoma al volver. Mismo criterio que el polling.
  useEffect(() => {
    const handleVisibility = () => {
      if (!wanted.current) return
      if (document.visibilityState === "visible") startWatching()
      else stopWatching()
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      stopWatching()
    }
  }, [startWatching, stopWatching])

  return { status, position, request, clear }
}
