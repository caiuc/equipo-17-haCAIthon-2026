import { useEffect, useRef, useState } from "react"

/**
 * `maximumAge: 0` a proposito: una posicion cacheada del navegador es
 * exactamente el dato viejo presentado como fresco que el principio rector
 * prohibe. Si el GPS no tiene fijeza nueva, preferimos no tener nada.
 */
const GEO_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }

/**
 * Una fijeza del GPS lista para mandar al API.
 *
 * La Geolocation API entrega `speed` en m/s y el resto del sistema habla km/h
 * (asi lo guarda `Position.speed` y asi lo lee el mapa). `heading` llega NaN
 * cuando el telefono esta quieto: eso es "no se", y va como null en vez de 0,
 * que significaria "mirando al norte".
 */
const toFix = (position) => {
  const { latitude, longitude, accuracy, speed, heading } = position.coords
  return {
    latitude,
    longitude,
    accuracyMeters: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    speed: Number.isFinite(speed) && speed >= 0 ? Math.min(300, Math.round(speed * 3.6)) : null,
    heading: Number.isFinite(heading) ? Math.round(heading) % 360 : null,
    timestamp: Math.round(position.timestamp),
  }
}

const GEO_MESSAGES = {
  2: "El teléfono no está logrando una posición GPS. Revisa que la ubicación esté encendida.",
  3: "El GPS está tardando más de lo normal en dar una posición.",
}

/**
 * Ubicacion continua del telefono del chofer.
 *
 * Devuelve tambien `fixRef` porque el bucle de transmision necesita la ultima
 * fijeza sin volver a montarse en cada una: el GPS emite mas seguido que
 * DRIVER_PING_INTERVAL_MS y reiniciar el bucle en cada callback reventaria el
 * temporizador.
 */
export function useDriverGeolocation(enabled) {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator
  const [fix, setFix] = useState(null)
  const [permission, setPermission] = useState(supported ? "prompt" : "unsupported")
  const [error, setError] = useState(null)
  const fixRef = useRef(null)

  useEffect(() => {
    if (!enabled || !supported) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const sample = toFix(position)
        fixRef.current = sample
        setFix(sample)
        setPermission("granted")
        setError(null)
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setPermission("denied")
          setError(null)
          return
        }
        // Un fallo transitorio NO borra la ultima fijeza: sigue siendo la mejor
        // informacion disponible, y su edad ya se muestra en pantalla.
        setError(GEO_MESSAGES[geoError.code] ?? "El GPS no está respondiendo.")
      },
      GEO_OPTIONS
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled, supported])

  return { fix, fixRef, permission, error }
}
