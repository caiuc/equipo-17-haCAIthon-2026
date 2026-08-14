import { useEffect } from "react"
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps"

/**
 * El trazado es contexto, no contenido: lo que el pasajero vino a mirar son las
 * micros. De ahi el grosor fino y la opacidad baja — si compitiera con los
 * sprites, taparia la respuesta a "¿viene o no viene?".
 */
const CASING = { color: "#ffffff", weight: 7, opacity: 0.6 }
const LINE = { weight: 3.5, opacity: 0.7 }

/**
 * Polilinea del recorrido elegido, con el color de su empresa.
 *
 * `@vis.gl/react-google-maps` no exporta un componente `<Polyline>`, asi que hay
 * que crear el objeto imperativo y — sobre todo — soltarlo en el cleanup. Una
 * polilinea de Google Maps no vive en el arbol de React: si no se le hace
 * `setMap(null)`, cambiar de recorrido deja la anterior dibujada y a los pocos
 * cambios el mapa es una maraña de rutas que ya nadie eligio.
 *
 * @param {Array<{lat: number, lng: number}>} path puntos del trazado (ver
 *   useRoutePath); debe venir memoizado o el efecto recrea la linea en cada render
 * @param {string} color hex de la empresa
 */
export function RoutePolyline({ path, color = "#1d1d1f" }) {
  const map = useMap()
  const maps = useMapsLibrary("maps")

  useEffect(() => {
    if (!map || !maps || path.length < 2) return

    // Dos trazos, uno blanco debajo del de la empresa. Los recorridos largos de
    // MuniBus Paine (hasta 61 paraderos) se doblan sobre si mismos y siguen las
    // mismas calles que dibuja el mapa base: sin ese borde blanco la linea se
    // confunde con el callejero y el recorrido se lee como un garabato.
    const casing = new maps.Polyline({
      map,
      path,
      clickable: false,
      strokeColor: CASING.color,
      strokeWeight: CASING.weight,
      strokeOpacity: CASING.opacity,
      zIndex: 1,
    })

    const line = new maps.Polyline({
      map,
      path,
      clickable: false,
      strokeColor: color,
      strokeWeight: LINE.weight,
      strokeOpacity: LINE.opacity,
      zIndex: 2,
    })

    return () => {
      casing.setMap(null)
      line.setMap(null)
    }
  }, [map, maps, path, color])

  return null
}
