import { useEffect, useState } from "react"

/** Un tick por segundo alcanza: los umbrales de frescura estan en decenas de segundos. */
const TICK_MS = 1000

/**
 * Milisegundos transcurridos desde una marca de `performance.now()`.
 *
 * Es un reloj monotono del navegador, no la hora del telefono: solo mide
 * intervalos. Con eso el dato mostrado envejece aunque el polling se corte —
 * una micro deja de decir "En vivo" sola — sin comparar nunca un reloj
 * desfasado contra `serverTime`.
 *
 * @param {number|null} stamp marca devuelta por el hook de polling
 */
export function useElapsedSince(stamp) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (stamp == null) {
      setElapsedMs(0)
      return
    }

    const update = () => setElapsedMs(Math.max(0, performance.now() - stamp))
    update()
    const timer = setInterval(update, TICK_MS)
    return () => clearInterval(timer)
  }, [stamp])

  return elapsedMs
}
