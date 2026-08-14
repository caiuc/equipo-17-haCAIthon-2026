import { useEffect } from "react"
import { AdvancedMarker, AdvancedMarkerAnchorPoint, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"

/**
 * Bajo este error la incertidumbre es mas chica que el propio punto en pantalla,
 * asi que dibujar el circulo solo agregaria ruido. Por encima se dibuja: un
 * punto solido con 800 m de error es exactamente la falsa precision que este
 * proyecto existe para no cometer, la misma clase de mentira que mostrar una
 * posicion vieja como fresca.
 */
const ACCURACY_HALO_MIN_M = 25

const HALO_STROKE = "#1a73e8"
const HALO_FILL = "#1a73e8"

/**
 * Circulo de precision, en metros reales sobre el suelo.
 *
 * Tiene que ser un `google.maps.Circle` y no un div: un halo en pixeles diria
 * "50 m" a un zoom y "5 km" a otro. Como no hay componente en la libreria de
 * React, se crea imperativo y se suelta en el cleanup, igual que la polilinea.
 */
function AccuracyHalo({ center, accuracy }) {
  const map = useMap()
  const maps = useMapsLibrary("maps")

  useEffect(() => {
    if (!map || !maps || !center || !(accuracy > ACCURACY_HALO_MIN_M)) return

    const circle = new maps.Circle({
      map,
      center,
      radius: accuracy,
      clickable: false,
      strokeColor: HALO_STROKE,
      strokeOpacity: 0.35,
      strokeWeight: 1,
      fillColor: HALO_FILL,
      fillOpacity: 0.12,
      zIndex: 0,
    })

    return () => circle.setMap(null)
  }, [map, maps, center, accuracy])

  return null
}

/**
 * Donde esta el pasajero.
 *
 * El punto azul con halo es el simbolo que la gente ya aprendio en Google Maps y
 * en Uber, y por eso no se parece en nada a una micro: confundir "yo" con "un
 * bus" en un mapa donde lo unico que importa es la distancia entre los dos seria
 * el peor error posible de lectura.
 */
export function UserLocationMarker({ position }) {
  if (!position) return null

  const center = { lat: position.lat, lng: position.lng }

  return (
    <>
      <AccuracyHalo center={center} accuracy={position.accuracy} />
      <AdvancedMarker
        position={center}
        anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
        clickable={false}
        title="Tu ubicación"
        zIndex={5}
      >
        <span className="block h-4 w-4 rounded-full border-2 border-white bg-[#1a73e8] shadow-[0_1px_4px_rgba(0,0,0,0.4)]" />
      </AdvancedMarker>
    </>
  )
}
