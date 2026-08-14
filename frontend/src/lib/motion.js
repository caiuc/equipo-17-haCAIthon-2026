/** Utilidades de movimiento del marcador: rumbo continuo y motion reducido. */

import { useEffect, useRef, useState } from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** true si el sistema pide menos animacion. Se respeta: nada gira ni pulsa. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
  )

  useEffect(() => {
    const media = window.matchMedia?.(REDUCED_MOTION_QUERY)
    if (!media) return

    const update = () => setReduced(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return reduced
}

/**
 * Angulo acumulado para rotar sin saltos.
 *
 * El rumbo llega en [0, 360): al cruzar el norte pasa de 358° a 2°, y una
 * transicion CSS sobre ese valor haria girar la micro 356° hacia atras. Se
 * acumula el delta corto (±180°) en un ref para que gire los 4° que realmente
 * giro.
 *
 * Devuelve null si no hay rumbo: orientar al norte "por defecto" seria inventar
 * una direccion de marcha.
 *
 * @param {number|null|undefined} heading grados desde el norte, o null
 */
export function useContinuousHeading(heading) {
  const accumulated = useRef(0)
  const previous = useRef(null)

  if (heading == null) {
    // Se olvida el ultimo rumbo: cuando vuelva, arranca desde el nuevo valor en
    // vez de girar acumulando un delta contra un dato de hace rato.
    previous.current = null
    return null
  }

  if (previous.current == null) {
    accumulated.current = heading
  } else {
    // Delta mas corto entre dos rumbos, en [-180, 180).
    accumulated.current += ((heading - previous.current + 540) % 360) - 180
  }
  previous.current = heading

  return accumulated.current
}
