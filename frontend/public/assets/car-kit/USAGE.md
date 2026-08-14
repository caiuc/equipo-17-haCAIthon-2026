# Kenney Car Kit — cómo usarlo en Miqui

Kit de vehículos 3D de Kenney (`www.kenney.nl`), traído para representar las
micros y flotas de las distintas empresas en el mapa de la vista de pasajero
(`frontend/src/components/passenger/MapView.jsx`).

## Licencia

**CC0 (Creative Commons Zero)** — ver `License.txt`. Uso libre para fines
personales, educativos y comerciales. Crédito a Kenney es apreciado pero no
obligatorio.

## Formatos incluidos

| Carpeta                  | Formato               | Cuándo usarlo |
|---------------------------|------------------------|---------------|
| `Previews/*.png`          | Imagen 2D top-down     | **Íconos de marcador en Google Maps** (enfoque recomendado ahora, ver más abajo) |
| `Models/GLB format/*.glb` | Modelo 3D (glTF binario) | Si más adelante se arma una escena 3D real (three.js / react-three-fiber) |
| `Models/OBJ format/*.obj` + `.mtl` + `Textures/` | Modelo 3D (OBJ/MTL) | Alternativa a GLB para pipelines que no soportan glTF |
| `Models/FBX format/*.fbx` | Modelo 3D (FBX) | Solo si se necesita para un motor externo (Unity/Unreal); no aplica al stack web actual |

## Enfoque recomendado: íconos 2D en el mapa

`MapView.jsx` ya dibuja un pin SVG genérico coloreado por estado de
"frescura" (`en-vivo` / `intermitente` / `sin-señal` / `fuera-de-servicio`,
ver `frontend/src/lib/freshness.js`), con el comentario:

> Placeholder hasta que se integren los assets 3D de vehículo del equipo de diseño.

La forma más rápida y consistente con el estilo Uber (que también usa
íconos 2D sobre el mapa, no modelos 3D reales) es reemplazar `busIcon()` por
una imagen de `Previews/`:

```jsx
// frontend/src/components/passenger/MapView.jsx
function busIcon(vehiclePng, color, selected) {
  const size = selected ? 44 : 36
  return {
    url: `/assets/car-kit/Previews/${vehiclePng}`,
    scaledSize: { width: size, height: size },
    anchor: { x: size / 2, y: size / 2 },
  }
}

// al armar el Marker:
icon={busIcon(vehicleForEmpresa(micro.empresa), freshness.color, isSelected)}
```

Si se quiere mantener el borde/color de frescura sobre la foto del
vehículo (como el pin SVG actual), lo más simple es envolver el PNG con un
`<div>`/badge de color en vez de tratar de teñir el PNG, o generar un SVG
compuesto (círculo de color + `<image>` del PNG) igual que el `busIcon`
actual pero con `<image href="...">` en vez del path del bus.

## Mapeo sugerido vehículo → rol en la app

Ningún modelo del kit es literalmente un bus/micro, así que se eligieron los
más cercanos visualmente. Esto es una sugerencia de partida — el equipo
puede ajustar el mapeo por empresa:

| Vehículo (`Previews/<nombre>.png`) | Uso sugerido |
|---|---|
| `van.png` | Micro rural estándar (default si no hay match) |
| `delivery.png`, `delivery-flat.png` | Furgón / micro chica |
| `truck.png`, `truck-flat.png` | Bus interurbano / recorrido más grande |
| `taxi.png` | Transporte informal/alternativo (si se modela a futuro) |
| `tractor.png`, `tractor-shovel.png`, `tractor-police.png` | Solo ambientación rural en el mapa, no vehículo de pasajeros |

Fuera de alcance de esta feature (no se usan): `sedan*`, `suv*`, `race*`,
`hatchback-sports`, `kart-*`, `police`, `ambulance`, `firetruck`,
`garbage-truck`, `debris-*`, `wheel-*`, `cone*`, `box`.

## Si más adelante se hace una escena 3D real

Los `.glb` en `Models/GLB format/` están listos para cargarse con
`@react-three/fiber` + `@react-three/drei` (`useGLTF`). No es el enfoque
recomendado para el MVP de hackathon por el costo de integración (overlay
WebGL sincronizado con el mapa, iluminación, LOD, etc.), pero los assets ya
están disponibles si el equipo decide subir la fidelidad después.
