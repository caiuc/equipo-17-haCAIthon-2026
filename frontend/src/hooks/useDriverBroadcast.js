import { useEffect, useRef, useState } from "react"
import { DRIVER_PING_INTERVAL_MS } from "@equipo17/shared"
import { driver } from "@/lib/api"
import { useDriverGeolocation } from "./useDriverGeolocation"

/**
 * Tope del lote, igual al `max(200)` de `postPositionsSchema`. Con un ping cada
 * DRIVER_PING_INTERVAL_MS son mas de trece minutos de corte sin perder nada.
 */
const MAX_BUFFER = 200

const INITIAL = {
  /** Marca monotona de la ultima transmision aceptada por el servidor. */
  lastSuccessStamp: null,
  everSent: false,
  pendingCount: 0,
  /** Tamano del ultimo lote aceptado: >1 significa que se recupero de un corte. */
  lastBatchSize: 0,
  failures: 0,
  sendError: null,
  /** El servidor descarto posiciones por venir del futuro (reloj adelantado). */
  clockSkew: false,
}

/** El API solo conoce estos campos; lo demas es del telefono y no viaja. */
const toPayload = ({ latitude, longitude, speed, heading, timestamp }) => ({
  latitude,
  longitude,
  speed,
  heading,
  timestamp,
})

/**
 * Bucle de transmision del chofer.
 *
 * Es la contracara de la decision de usar HTTP polling en vez de WebSockets: un
 * POST que falla no arrastra estado, solo deja su posicion en un buffer que se
 * vacia entero en el siguiente intento. En zona rural eso es la diferencia entre
 * perder el tramo sin senal y recuperarlo completo.
 *
 * Tres cosas que NO hace, a proposito:
 *
 * - No reencola la misma fijeza dos veces (`lastQueuedRef`): repetir un punto
 *   viejo con timestamp nuevo lo haria parecer fresco, que es la mentira que el
 *   principio rector prohibe. Si el GPS se congela, la micro se degrada sola en
 *   la pantalla del pasajero, que es la verdad.
 * - No se pausa con la pestana oculta, al reves que el polling del pasajero: el
 *   chofer no eligio dejar de transmitir. El navegador igual lo estrangula, y
 *   por eso la interfaz lo advierte en vez de esconderlo.
 * - No trata un 202 con `accepted: 0` como exito. Eso pasa cuando el reloj del
 *   telefono va adelantado y el servidor descarta las muestras: encender el
 *   indicador verde ahi seria decirle al chofer que transmite cuando no.
 */
export function useDriverBroadcast({ tripId, onAuthError, onTripGone }) {
  const enabled = Boolean(tripId)
  const { fix, fixRef, permission, error: geoError } = useDriverGeolocation(enabled)
  const [state, setState] = useState(INITIAL)
  const [screenLocked, setScreenLocked] = useState(false)

  const bufferRef = useRef([])
  const lastQueuedRef = useRef(null)
  // Callbacks en refs: si entraran en las dependencias del efecto, un render del
  // padre reiniciaria el temporizador y el ping se iria al tacho.
  const onAuthErrorRef = useRef(onAuthError)
  const onTripGoneRef = useRef(onTripGone)
  onAuthErrorRef.current = onAuthError
  onTripGoneRef.current = onTripGone

  useEffect(() => {
    if (!tripId) return

    bufferRef.current = []
    lastQueuedRef.current = null
    setState(INITIAL)

    let stopped = false
    let timer = null

    const send = async () => {
      const batch = bufferRef.current
      if (batch.length === 0) return

      try {
        const result = await driver.sendPositions(tripId, batch.map(toPayload))
        if (stopped) return
        bufferRef.current = bufferRef.current.slice(batch.length)

        const accepted = result?.accepted ?? batch.length
        if (accepted === 0) {
          setState((prev) => ({
            ...prev,
            failures: prev.failures + 1,
            pendingCount: bufferRef.current.length,
            clockSkew: true,
            sendError: "El servidor rechazó las posiciones: la hora del teléfono está adelantada.",
          }))
          return
        }

        setState((prev) => ({
          ...prev,
          lastSuccessStamp: performance.now(),
          everSent: true,
          pendingCount: bufferRef.current.length,
          lastBatchSize: batch.length,
          failures: 0,
          sendError: null,
          clockSkew: false,
        }))
      } catch (err) {
        if (stopped) return

        if (err?.status === 401) {
          stopped = true
          onAuthErrorRef.current?.()
          return
        }

        // 404/409: el turno ya no existe o lo cerraron desde otro dispositivo.
        // Seguir posteando solo acumularia errores contra un turno muerto.
        if (err?.status === 404 || err?.status === 409) {
          stopped = true
          onTripGoneRef.current?.(err.message)
          return
        }

        // Lo acumulado se conserva y sale junto en el proximo intento.
        bufferRef.current = bufferRef.current.slice(-MAX_BUFFER)
        setState((prev) => ({
          ...prev,
          failures: prev.failures + 1,
          pendingCount: bufferRef.current.length,
          sendError: err?.message ?? "No se pudo enviar la posición.",
        }))
      }
    }

    const tick = async () => {
      timer = null

      const sample = fixRef.current
      if (sample && sample.timestamp !== lastQueuedRef.current) {
        lastQueuedRef.current = sample.timestamp
        bufferRef.current.push(sample)
        if (bufferRef.current.length > MAX_BUFFER) {
          bufferRef.current = bufferRef.current.slice(-MAX_BUFFER)
        }
      }

      await send()

      // Encadenado y no setInterval: con senal mala un POST puede tardar mas que
      // el intervalo, y encimar peticiones sobre una conexion que ya no da mas
      // solo empeora el corte.
      if (!stopped) timer = setTimeout(tick, DRIVER_PING_INTERVAL_MS)
    }

    tick()

    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [tripId, fixRef])

  // Mantener la pantalla encendida no convierte esto en una app nativa, pero
  // evita el fallo mas comun: el telefono montado que se apaga solo a los 30 s.
  useEffect(() => {
    if (!tripId || !("wakeLock" in navigator)) return
    let sentinel = null
    let released = false

    const acquire = async () => {
      if (released || document.visibilityState !== "visible") return
      try {
        sentinel = await navigator.wakeLock.request("screen")
        if (released) {
          sentinel.release()
          return
        }
        setScreenLocked(true)
        sentinel.addEventListener("release", () => setScreenLocked(false))
      } catch {
        // Sin permiso o sin soporte real: la advertencia en pantalla ya cubre el caso.
        setScreenLocked(false)
      }
    }

    acquire()
    document.addEventListener("visibilitychange", acquire)

    return () => {
      released = true
      document.removeEventListener("visibilitychange", acquire)
      sentinel?.release().catch(() => {})
      setScreenLocked(false)
    }
  }, [tripId])

  return { ...state, fix, permission, geoError, screenLocked }
}
