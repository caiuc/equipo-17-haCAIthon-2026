# render-sprites

Genera los sprites de micros por empresa que el mapa dibuja sobre cada posicion
en vivo. Pre-renderiza los modelos GLB del [Car Kit de Kenney][kenney] (CC0) a
una vista cenital-oblicua, con la carroceria repintada del color de cada
empresa.

## Regenerar

```bash
python3 tools/render-sprites/render_sprites.py
```

Sin dependencias: solo la stdlib de Python 3 (`zlib`, `struct`, `math`). No hay
que instalar nada ni tener GPU. Los nueve sprites tardan ~6 s en total.

Entrada: `apps/api/tools/kenney/Models/GLB format/` (los `.glb` mas
`Textures/colormap.png`; los `.glb` referencian la textura por URI relativa, asi
que `Textures/` tiene que quedar al lado).
Salida: `frontend/public/assets/micros/<slug>.png`, 128x128 RGBA.

Opciones utiles:

```bash
python3 tools/render-sprites/render_sprites.py --only bupesa
python3 tools/render-sprites/render_sprites.py --elevation 55 --supersample 6
```

## Empresas

La tabla `COMPANIES` en `render_sprites.py` es la fuente de verdad de que modelo
y que color usa cada empresa. Los slugs tienen que coincidir uno a uno con la
lista blanca de `packages/shared/src/vehicle.ts`; `generico` es el
`DEFAULT_ASSET_SLUG` que usan las empresas creadas desde el panel de admin, y
por eso no puede faltar.

Agregar una empresa = una fila en `COMPANIES` y volver a correr el script.

## Por que 62 grados y no 31

Los PNG que vienen en `Previews/` del kit estan renderizados a **31 grados de
elevacion**: una vista casi de perfil, pensada para un catalogo, no para un
mapa. Ese angulo no sirve aca porque el frontend orienta la micro con un
`transform: rotate(headingDeg)`, es decir una rotacion 2D de la imagen.

Una rotacion 2D solo se lee como un giro sobre el suelo si la camara esta
suficientemente cenital. A 31 grados domina el perfil del vehiculo: al rotar el
sprite 180 grados la micro queda literalmente con las ruedas para arriba, y a
90 grados se ve el costado apuntando al norte. La referencia de la industria
(Uber y similares) usa 65-75 grados.

A **62 grados** la proyeccion es lo bastante cenital como para que la rotacion
2D funcione en los 360 grados, pero conserva algo de volumen — se ven el techo,
el parabrisas y un poco de los costados — asi que la micro sigue leyendose como
un vehiculo con frente y no como un rectangulo plano. Es el compromiso entre
"rota bien" y "se reconoce".

## Como funciona

1. `glb.py` parsea el GLB (chunk JSON + chunk BIN), recorre la escena aplicando
   el TRS de cada nodo y devuelve triangulos en espacio de escena con posicion,
   normal y UV.
2. El atlas `colormap.png` es una grilla de 8x4 celdas de 64x128. La **fila 1**
   (0-based) es la pintura de carroceria y cada modelo usa una sola columna de
   esa fila — `body_cell_column()` la deduce contando UVs. Repintar esa celda
   con el color de la empresa cambia la micro completa sin tocar vidrios,
   neumaticos ni luces, que viven en otras filas.
3. `render()` proyecta con una camara **ortografica** a 62 grados. Los modelos
   del Car Kit son Y-up con el frente en **+Z** (los nodos `wheel-front-*` estan
   en z positivo), y la camara se ubica en `(0, sin e, -cos e)` para que +Z caiga
   hacia **arriba** en pantalla: heading 0 = norte = sprite sin rotar.
4. Rasteriza con coordenadas baricentricas y z-buffer, muestrea la textura
   recoloreada y aplica un lambert suave (60% ambiente / 40% difuso).
5. Renderiza a 4x y promedia por caja (`downsample`). El color se promedia solo
   sobre las muestras cubiertas, para que el borde no se ensucie de negro.
6. `pngio.py` escribe el PNG RGBA (tambien sabe leerlo, para el atlas).

La escala se calcula por **radio** desde el centro, no por bounding box: el
frontend rota el sprite sobre su centro, asi que el dibujo tiene que caber en el
circulo inscrito o algunos rumbos recortarian la micro.

## Licencia

Los modelos son CC0 de Kenney. El texto original queda en
`apps/api/tools/kenney/License.txt` y junto a los sprites en
`frontend/public/assets/micros/LICENSE-kenney.txt`.

[kenney]: https://kenney.nl/assets/car-kit
