import { useMemo } from "react"
import { useMapsLibrary } from "@vis.gl/react-google-maps"

/**
 * Puntos con los que se dibuja el recorrido en el mapa.
 *
 * Cuando el recorrido trae `pathPolyline` se usa el trazado real por las calles,
 * que es lo que hace que un recorrido de 61 paraderos se lea como un camino y no
 * como un garabato: uniendo paraderos en linea recta, cada curva del camino se
 * convierte en un corte que atraviesa manzanas.
 *
 * `pathPolyline` es null en los recorridos que todavia no tienen trazado
 * calculado — lo produce un script aparte contra una API que cobra por llamada —
 * y eso NO se asume nunca: ahi se cae a unir los paraderos, que sigue siendo
 * mejor que no dibujar nada.
 *
 * @param {string|null} pathPolyline polilinea codificada de Google
 * @param {Array<{lat: number, lng: number}>} stops paraderos ya ordenados por
 *   stopOrder; debe venir con identidad estable o el mapa redibuja en cada render
 */
export function useRoutePath(pathPolyline, stops) {
  const geometry = useMapsLibrary("geometry")

  return useMemo(() => {
    if (pathPolyline && geometry) {
      return geometry.encoding
        .decodePath(pathPolyline)
        .map((point) => ({ lat: point.lat(), lng: point.lng() }))
    }
    return stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))
  }, [pathPolyline, geometry, stops])
}
