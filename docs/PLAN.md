# Miqui — simulación de micros en vivo, multi-empresa, estilo Uber

## Contexto

En zonas rurales de Chile nadie sabe si la micro ya pasó. La app responde una
sola pregunta: **¿viene o no viene?**, bajo el principio rector del proyecto —
*nunca mostrar información sin declarar qué tan vieja es*.

El backend ya resuelve el ciclo completo y está en `origin/develop`. El frontend
ya está conectado al API real en `feat/frontend-api`. Lo que falta es que el mapa
tenga **más de una empresa y micros moviéndose de verdad**, con un asset distinto
por empresa, para que la demo se vea como transporte real y no como un punto
deslizándose.

Esta rama entrega:

1. **Datos de 8 empresas rurales reales** con recorridos, horarios y tarifas —
   sembrando lo verificado y declarando explícitamente lo pendiente.
2. **Una simulación multi-empresa**: ~18 micros de 8 empresas recorriendo la
   Región Metropolitana, cada una con su sprite propio, en los cuatro estados de
   frescura.
3. **El mapa del pasajero con estética Uber**, con sprites rotados por rumbo
   reemplazando los pines de círculo actuales.

## Estado real del repositorio (verificado 2026-08-14)

```
dcfda0b Initial commit
├─ 94304c1 monorepo ─ e852bff Merge PR #1 ─ 952d212 origin/develop   ← backend completo
│                                            └─ 1eccb89 origin/infra/deploy
└─ 3506074 gitignore ─ 06ccbfe scaffold ─ c11d7e4 landing ─ 9a25ac7 mockup
   ├─ 39448bf origin/map-ui
   ├─ a5d8989 origin/assets/car-kit          ← hermana de map-ui, NO de main
   └─ 0868d78 merge ─ b228ef9 origin/feat/frontend-api   ← LA RAMA VIVA
```

**`feat/frontend-api` es el estado actual del proyecto**: mergeó `develop` en la
línea del frontend, conectó `frontend/` al API real (`lib/api.js`, `useAuth`,
`useLiveRoute`, `useRouteSearch`) y añadió el panel de empresa completo
(`CompanyApp` + 7 componentes). `infra/scripts/deploy-web.sh` ya despliega
`frontend/dist`. **`apps/web` quedó abandonado.**

Sin commitear ahora mismo: `frontend/yarn.lock` reescrito (−4314/+1817) y un
`frontend/package-lock.json` nuevo de 134 KB. Alguien corrió `npm install` sobre
un proyecto yarn.

## Decisiones tomadas

1. **`frontend/` se mueve al workspace pnpm**, conservando el JSX tal cual. Cero
   reescritura de componentes. `apps/web` se elimina.
2. **Un solo gestor: pnpm.** Se borran `yarn.lock` y `package-lock.json`.
3. **Assets**: Kenney Car Kit 3.1 (CC0), **sprites pre-renderizados desde los
   `.glb` a ~62° de elevación**, no los PNG de `Previews/`.
4. **Un modelo y un color por empresa.** Todas son micros; lo que cambia es el
   vehículo, para distinguirlas de un vistazo.
5. **Sin `VehicleType`**: el asset lo define la empresa (`Company.assetSlug`),
   con override opcional en `Bus.assetSlug`.
6. **Datos**: se siembra lo verificado; lo que falta se declara pendiente, nunca
   se inventa.
7. **Rama nueva `feat/simulacion-multiempresa`, desde `feat/frontend-api`.**

## Credenciales de Google Maps (listas)

```bash
# frontend/.env  (gitignoreado)
VITE_GOOGLE_MAPS_API_KEY=AIzaSyB8NXdgoUBST8Mo60JHpCzwhEVOvsAtlJI
VITE_GOOGLE_MAPS_MAP_ID=8b13685d5f71bc1b64a29c0d
```

Map ID "miqui" ya creado: JavaScript, **vectorial**, con inclinación y rotación
habilitadas como capacidad. El `<Map>` las fija en cero igualmente
(`tilt={0}`, `heading={0}`): el contenido de un `AdvancedMarker` es DOM en el
plano de la pantalla, no se inclina con el suelo, y si el usuario rotara el mapa
las micros apuntarían con el desfase del rumbo. Queda anotado como pendiente.

| API de Google | Estado | Uso |
|---|---|---|
| Maps JavaScript | ✅ habilitada | Mapa y `AdvancedMarker` |
| Places (new) | ✅ habilitada | **Geocodificar** terminales y localidades del seed |
| Routes | ❌ deshabilitada | Trazado real por carretera (opcional, ver paso 5) |

**Pendiente de seguridad**: la clave respondió a `curl` sin referrer, o sea no
tiene restricciones. Hay que ponerle *Sitios web (referrers HTTP)* con
`http://localhost:5173/*` y el dominio de CloudFront, limitarla a Maps JS +
Places, y crear una alerta de facturación. Una `VITE_*` queda como string literal
dentro de `dist/assets/index-<hash>.js`: no se protege ocultándola, se protege
restringiéndola.

---

## Especificación visual (de las capturas de Uber)

| Uber | Miqui |
|---|---|
| Mapa a sangre arriba, estilo claro desaturado | Igual — el estilo va asociado al Map ID |
| Autos 3/4 desde arriba, **rotados según su rumbo** | Sprites Kenney rotados por `heading`, uno por empresa |
| Wordmark arriba izquierda, botón circular blanco arriba derecha | Ya implementado en `PassengerApp.jsx` |
| Sheet blanco redondeado con pill de arrastre | Ya implementado en `RideSheet.jsx` (colapsable) |
| "Choose a ride" → "Recommended" → filas | "Elegir micro" → "En ruta ahora" |
| Miniatura del vehículo a la izquierda de la fila | El mismo sprite que se ve en el mapa |
| Nombre bold + `👤4` de capacidad | Empresa + código de recorrido, y `Bus.seats` |
| Precio bold a la derecha | Tarifa adulto · **Gratis** · **Tarifa por confirmar** |
| Fila seleccionada con anillo negro 2px | Igual |
| Chip azul "Faster" | **Chip de frescura**: En vivo / Señal intermitente / Sin señal |

El chip es donde Uber y el principio rector coinciden: ellos venden velocidad,
nosotros declaramos antigüedad. Es el requisito §4.5, no decoración.

**Estados que Uber no tiene y aquí son obligatorios**: "no hay micros en ruta"
con el teléfono de la empresa como salida, y "sin señal" con la micro atenuada,
congelada y **sin distancia** (`distanceMeters` llega `null` a propósito).

---

## A. Mover `frontend/` al workspace pnpm

Es el paso que desbloquea todo lo demás, porque hoy `frontend/` no puede importar
`@equipo17/shared` y por eso duplica los umbrales de frescura a mano.

1. `pnpm-workspace.yaml`: añadir `- 'frontend'` a `packages`.
2. `frontend/package.json`: `"name": "@equipo17/web"`, añadir
   `"@equipo17/shared": "workspace:*"`, y **bajar** `vite` de `^8.2.0` a `^6.0.7`
   y `@vitejs/plugin-react` de `^6.0.4` a `^4.3.4` para alinear con el lockfile
   del monorepo.
3. Borrar `frontend/yarn.lock`, `frontend/package-lock.json`, `.yarnrc.yml`.
4. Eliminar `apps/web/` completo (era el scaffold de items).
5. `packages/shared/src/item.ts` y su re-export en `index.ts`: borrar — el
   comentario `TEMPORAL` ya anunciaba esta limpieza y se queda sin consumidores.
6. **`frontend/src/lib/constants.js` se borra** y sus consumidores importan de
   `@equipo17/shared`. Este archivo es la fuente de la mentira: su propio
   comentario admite que hay que sincronizarlo a mano.
7. `eslint.config.js` y `.prettierignore`: incluir `frontend/**` con los globals
   de navegador. Hoy `pnpm lint` fallaría con `no-undef` en `document`/`window`
   porque el bloque de globals está limitado a `apps/web/**`.
8. `frontend/CLAUDE.md`: borrar la línea "usa yarn, no pnpm" y absorber sus
   reglas útiles (Tailwind-first, shadcn antes que componente propio,
   `ui/` intacta) en el `CLAUDE.md` raíz.
9. `infra/scripts/deploy-web.sh`: volver a `pnpm --filter @equipo17/web build`,
   manteniendo `WEB_DIR="$REPO_ROOT/frontend"`.

Verificación: `pnpm install && pnpm lint && pnpm format:check && pnpm typecheck
&& pnpm test && pnpm build` — los cinco pasos del CI.

## B. Esquema Prisma

`Company` gana identidad, marca, contacto y procedencia:

```prisma
enum CompanyKind { PRIVATE  MUNICIPAL }
enum PassengerType { ADULT  STUDENT  SENIOR }

model Company {
  id   String @id @default(cuid())
  /// Clave natural estable del seed. El rut no sirve: los servicios
  /// municipales no tienen uno, y seed.ts hace upsert por empresa.
  slug String @unique
  name String
  rut  String? @unique
  kind CompanyKind @default(PRIVATE)
  /// Color de marca con el que se pinta la carroceria de sus micros.
  color String @default("#1B5FC1")
  /// Modelo del kit Kenney. Es un nombre de archivo, NO una URL: se valida
  /// contra lista blanca en shared antes de que el cliente arme la ruta.
  assetSlug String @default("delivery")
  phone     String?
  website   String?
  /// De donde salio la ficha y cuando se consulto. La tarifa de Damir viene de
  /// un articulo de julio de 2022: mostrarla sin esa fecha seria presentar como
  /// vigente un dato de hace cuatro anos.
  sourceUrl       String?
  sourceCheckedAt DateTime?
  status    CompanyStatus @default(ACTIVE)
  // ...timestamps y relaciones, mas `buses Bus[]`
}

/// Tarifa publicada, por recorrido y tipo de pasajero.
/// Modelo aparte y no columna en Route porque la AUSENCIA de fila significa
/// "no publicada", y eso no es lo mismo que 0: hay servicios municipales
/// efectivamente gratuitos. Colapsar ambos casos en un Int con default 0 haria
/// que el mapa dijera "Gratis" donde en realidad no sabemos.
model Fare {
  id            String @id @default(cuid())
  routeId       String
  passengerType PassengerType
  /// Pesos chilenos, entero. No hay decimales en el pasaje.
  amountClp     Int
  route Route @relation(fields: [routeId], references: [id], onDelete: Cascade)
  @@unique([routeId, passengerType])
}

/// Vehiculo concreto. Opcional en todo el flujo: el turno se inicia sin
/// declararlo y el mapa se pinta igual, cayendo al asset de la empresa.
model Bus {
  id        String @id @default(cuid())
  companyId String
  plate     String
  seats     Int?
  /// Override del asset de la empresa, para flota que no se ve como el resto.
  assetSlug String?
  active    Boolean @default(true)
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  trips   Trip[]
  @@unique([companyId, plate])
}
```

Más `fares Fare[]` en `Route`, y en `Trip`: `busId String?` + relación con
`onDelete: SetNull`. Sin índices extra: los `@@unique` compuestos ya dejan la
columna líder indexada.

### Migración: a mano, en tres pasos para `slug`

Hay un RDS real y `docker-entrypoint.sh` corre `prisma migrate deploy` en cada
despliegue — **pero con `|| echo "AVISO"`, así que si la migración falla el API
arranca igual** con un cliente Prisma desalineado. La migración tiene que estar
bien escrita, no resolverse con `db:reset`.

```sql
-- Todo lo nuevo lleva DEFAULT: el ADD COLUMN NOT NULL es seguro sobre filas
-- existentes. slug es la unica que no admite default y por eso va en 3 pasos.
ALTER TABLE "Company" ADD COLUMN "slug" TEXT;
UPDATE "Company" SET "slug" = 'bupesa' WHERE "rut" = '96.812.340-7';
UPDATE "Company" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "Company" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
```

`seed.ts:354` cambia de `where: { rut }` a `where: { slug }`.

## C. Contratos en `packages/shared`

- `company.ts`: `companyBriefSchema` (`id`, `slug`, `name`, `color`,
  `assetSlug`), `publicCompanySchema`, `companyKindSchema`.
- `vehicle.ts`: **`ASSET_SLUGS` como lista blanca** — `z.enum([...])`, no
  `z.string()`. El slug construye una ruta de archivo en el cliente.
- `fare.ts`: `fareSchema` + `fareFor(fares, type): number | null`.
- `route.ts`: `companyName: string` → `company: companyBriefSchema`, más
  `fares: fareSchema.array()`.
- `live.ts`: `liveBusSchema` gana `routeCode`, `company`, `plate`, `seats`,
  `fareAdultClp: number | null`; más `bboxSchema`, `liveBusesQuerySchema` y
  `liveBusesSchema`.

Una sola definición de `companyBrief`, tres consumidores, cero deriva.

## D. Backend: el endpoint del mapa

`GET /api/live/buses?bbox=&companyId=&routeId=&stopId=&limit=` en
`public.routes.ts` (el `publicRouter` se monta sin prefijo, `routes/index.ts` no
se toca). Responde `{serverTime, stopId, buses[], total, truncated}` con
`Cache-Control: no-store`.

**bbox, no radio.** `map.getBounds()` ya devuelve un rectángulo; derivar un
círculo sobre-pide ~57% de área o pierde las esquinas del viewport, que es
justo donde el usuario acaba de arrastrar. Orden `minLng,minLat,maxLng,maxLat`
(RFC 7946), y **`west < east && south < north` validado con 400** — invertirlo
devolvería un mapa vacío sin ningún error, la peor clase de bug. `bbox` es
opcional: el primer render aún no tiene bounds.

**El catálogo se cachea, el store no se engorda.** `position.service.ts` ya hace
un `findUnique` por cada ping (15 veces por minuto por micro); ensancharlo con
empresa, color y tarifa encarecería el camino de escritura para poblar datos que
cambian una vez al mes, y además quedarían congelados al iniciar el turno. En su
lugar, `companyCatalog.service.ts` con TTL de 60 s: **1 query por minuto**. Debe
exportar `clearCatalogCache()` para que los tests sean deterministas.

La caché usa `Map<routeId, number | null>` poblado para **todos** los recorridos
activos, de modo que se distingan tres estados: `0` gratis de verdad, `null`
tarifa no publicada, ausente = recorrido desconocido. **Un `?? 0` en cualquier
punto destruye el invariante.**

`liveStore.ts` gana `getAllLiveTrips()` y `getLiveTripsInBounds(b)`, y su
`LiveTrip` solo suma lo que ya viene gratis del ping: `busId`, `plate`, `seats`,
`busAssetSlug`. `hydrateLiveTrips()` amplía su `include` con `bus` y acota a
`startedAt >= hace 24h`.

**Ordenar por frescura antes que por distancia**: `LIVE` gana siempre a
`INTERMITTENT` y este a `NO_SIGNAL`, antes de comparar distancias. Un dato viejo
nunca encabeza la lista aunque su última posición sea la más cercana.

**`driverName` sale del endpoint del mapa.** Hoy se expone de a un recorrido; el
endpoint nuevo entregaría el nombre completo de todos los choferes de todas las
empresas en una llamada, scrapeable cada 5 s. Es dato personal y el mapa no lo
necesita.

## E. Seed de las 8 empresas

Partir `prisma/seed.ts` (439 líneas) en:

```
apps/api/prisma/seed/
  index.ts            el escritor: PrismaClient + upserts
  types.ts            CompanySeed, RouteSeed, DriverSeed, BusSeed, Waypoint
  banner.ts           el aviso de aproximacion, en un solo lugar
  data/waypoints.ts   WP compartidos, geocodificados con Places
  data/index.ts       export const COMPANIES  ← SIN side effects
  data/{bupesa,talagante,islaval,damir,cobrexpress,paine,munibus,colina}.ts
```

**Regla dura: `data/**` no importa Prisma ni ejecuta nada.** Hoy `seed.ts:28`
instancia `PrismaClient` en el top level; importarlo desde el simulador abriría
una conexión a Postgres en un proceso que finge ser un teléfono. `tsup.config.ts`
cambia su entry a `prisma/seed/index.ts` conservando la clave `seed`, así
`dist/seed.js` no se mueve y `docker-entrypoint.sh` no se toca.

Terminal San Borja lo comparten seis de las ocho empresas: por eso `waypoints.ts`
es compartido. Un `WP` duplicado por empresa mostraría seis San Borja distintos
en el mapa.

Registrar `"prisma": { "seed": "tsx prisma/seed/index.ts" }` en el
`package.json` de la API — hoy falta, y por eso `migrate reset` deja la base
vacía y alguien lo olvida justo antes de una demo.

### Asignación de empresa → modelo y color

Renderizada y verificada sobre fondo claro:

| Empresa | Modelo | Color |
|---|---|---|
| Bupesa | `delivery` | azul cobalto `#1B5FC1` |
| Flota Talagante | `delivery` | rojo teja `#B3261E` |
| Islaval | `delivery` | teal `#0E8F8A` |
| Damir | `van` | violeta `#6D28D9` |
| Cobrexpress | `delivery` | cobre `#C2620E` |
| Buses Paine | `delivery` | verde bosque `#2E7D32` |
| MuniBus Paine | `suv-luxury` | magenta `#BE185D` |
| Acercamiento Colina | `van` | pizarra `#334155` |

~18 choferes y ~25 buses en total, suficiente para 12-15 micros simultáneas de
colores distintos. Bupesa **conserva** `chofer1..3@bupesa.cl`: están
documentados en `CLAUDE.md` y el equipo ya los memorizó.

### Política de datos: verificado se siembra, lo que falta se declara pendiente

**Ausencia significa pendiente, nunca cero y nunca un número plausible.**

| Dato | Verificado | Falta |
|---|---|---|
| Tarifa | fila de `Fare` | **sin fila** → "Tarifa por confirmar" |
| Tarifa gratuita | `Fare` con `amountClp: 0` | — (0 es real, no ausencia) |
| Horario | fila de `Schedule` | sin fila → "Horario por confirmar" |
| Paradero | `RouteStop` geocodificado con Places | punto aproximado, marcado en el banner |
| Teléfono | campo poblado | `null` → no se ofrece botón de llamar |

Estado por empresa (investigación del 2026-08-14, ~85 sentidos en total):

| Empresa | Sentidos | Tarifa adulto | Ventana | Calidad |
|---|---|---|---|---|
| **Bupesa** | ~22 con horario, códigos R750–R762 | **$700–$2.050 por tramo** (Peñaflor→Borja $1.350) | 03:52–23:25 | **Alta** |
| Flota Talagante | 12 (6 líneas) | ⏳ no publicada | 04:00–23:00 | Media-baja |
| Islaval | 6 (R720/R721/R722) | ⏳ no publicada | 05:00–22:00 | Media |
| Damir | ~8 | **$1.100** · TNE $350 | 04:45–23:30 | Media |
| Cobrexpress | 4 | **$1.600** Colina · **$2.600** Til Til | 05:30–23:00 | Media-alta |
| Buses Paine | 6 (Chada / Aculeo / La Paloma) | ⏳ no publicada | 05:00–23:00 | Media-baja |
| **MuniBus Paine** | **14 sentidos, ~500 paradas con GPS** | **$0 gratuito** | L-V, sin tabla | **Alta** |
| Acercamiento Colina | 13 líneas (M1–M17 + E27) | ⏳ no publicada | 05:20–23:00 | Media |

**Hallazgos que corrigen supuestos previos:**

- **Bupesa sí publica tarifas.** El PDF `Tarifas-Bupesa.pdf` (generado 2025-12-30)
  trae la tabla completa por tramo y tipo de pasajero. Se extrae con `pdftotext`.
  Dos asimetrías reales que hay que sembrar tal cual, no "corregir": estudiante
  Peñaflor→Borja $400 pero Borja→Peñaflor $450; y en Bollenar la tarifa de
  estudiante ($1.400) es **mayor** que la de adulto mayor ($1.000).
- **La tarifa de Damir del enlace está 4 años vencida.** El artículo es de julio
  2022 y da $1.300; la vigente en 2026 es **$1.100 con TNE $350**, y en abril de
  2026 Damir congeló tarifas. Sembrar $1.100.
- **Único RUT obtenido**: Cobrexpress `76.178.015-8`. Las otras siete no lo
  publican — de ahí que `slug` sea la clave natural y no `rut`.
- **Islaval promete un tarifario que no existe**: la página dice "Descargar Aquí
  el Tarifario" pero el HTML no tiene ningún enlace. Queda como pendiente.
- **El FAQ de Flota Talagante está sin terminar y con marcadores de plantilla
  visibles al público** (`"[confirmar valor exacto o rango]"`). No es fuente
  confiable de tarifas ni frecuencias.
- **Nunca cargar las referencias reguladas del MTT como tarifa de empresa.** Son
  techos tarifarios del perímetro (feb-2025), no precios publicados por Flota
  Talagante, Islaval ni Buses Paine.
- **Bupesa no publica paraderos** — su página los muestra como imágenes y el PDF
  solo trae primera y última salida. Confirma lo que ya dice el banner del seed.

### Coordenadas: reemplazar las del seed actual

El agente geocodificó ~55 localidades contra OpenStreetMap. Varios `WP` del seed
están desviados: **Malloco a 2,4 km**, `CALERA_TANGO` a 2,2 km, `CASA_VIEJAS` a
2,6 km, más `TALAGANTE`, `MAIPU` y `CERRILLOS`. Se reemplazan por las
geocodificadas. Las de MuniBus vienen del propio operador, no de un geocoder.

El banner del seed se amplía: las **patentes son inventadas**, los tipos de
vehículo son plausibles salvo donde la empresa los publica (Buses Paine declara
minibuses Mercedes y Volkswagen), y cada empresa lleva su `sourceCheckedAt`.

### 🎯 MuniBus Paine tiene una API pública en vivo

`https://munibus-production.up.railway.app` — OpenAPI 3.1, **sin autenticación**,
con `GET /api/trayectos`, `/api/trayectos/{id}/itinerario-en-vivo`,
`/api/buses/near?lat=&lng=&radius_km=` y `/api/paraderos/{id}/prediccion`.

De ahí salen **7 trayectos, 14 sentidos y ~500 paraderos con lat/lng a 6
decimales**, datos del operador. Y valida empíricamente la decisión de diseño de
CLAUDE.md: los sentidos son **asimétricos** — T4 tiene 26 paradas de ida y **61**
de vuelta.

Dos usos, en orden de ambición:

1. **Sembrar sus paraderos reales** (decidido): MuniBus deja de ser la empresa con
   peor geometría y pasa a ser la mejor, sin inventar un solo punto.
2. **Consumirla en vivo** (opcional, fuera del alcance de esta rama): sería la
   única empresa con micros **de verdad** moviéndose en el mapa junto a las
   simuladas. Alto impacto para el jurado, pero depende de un tercero que puede
   caerse durante la demo. Queda anotado, no comprometido.

## F. Simulador multi-empresa

`tools/simulator.ts` (268 líneas) pasa a carpeta, con las partes puras
testeables sin red:

```
apps/api/tools/simulator/
  index.ts   CLI, orquestacion, ciclo de vida, SIGINT
  fleet.ts   reparto round-robin y dispersion inicial  (puro)
  motion.ts  cinematica: velocidad, frenado, heading    (puro)
  signal.ts  perfiles de senal                          (puro)
  rng.ts     PRNG con semilla (mulberry32)
  apiClient.ts, cli.ts, types.ts
```

`tsconfig.json` y `vitest.config.ts` deben incluir `tools` y `prisma`: hoy no lo
hacen, así que el simulador y el seed **no pasan por `pnpm typecheck`**.

**Reparto round-robin por empresa, no por índice global.** El bug actual está en
`simulator.ts:208`: `DRIVERS[i % DRIVERS.length]` sobre una lista plana. Con 8
micros llenaría las primeras 2-3 empresas y el mapa saldría de un solo color.
Con reparto por vueltas, `BUSES=8` da las 8 empresas.

**Arranque disperso por metros, no por índice de paradero.** Los tramos van de
1,6 km a 8 km; dispersar por índice amontona las micros en los tramos urbanos
cortos. Se usa una secuencia de baja discrepancia (razón áurea) que reparte
parejo para cualquier N.

**Velocidad por geometría del recorrido, no por columna nueva en la base**:
tramos > 4 km → interurbano ~78 km/h; < 1,2 km → urbano ~32 km/h; el resto rural
~52 km/h. Más variación por micro fijada una vez (no por tick, o la micro
oscilaría entre 40 y 80 km/h y se vería rota), frenado proporcional al acercarse
al paradero, y detención breve con probabilidad según perfil. **Mientras está
detenida sigue emitiendo con `speed: 0`**: dejar de emitir haría que la frescura
se degradara y estaríamos mintiendo sobre el motivo — una micro parada en el
paradero no es una micro sin señal.

**Perfiles de señal.** Descartar pings al azar no alcanza para mostrar "Señal
intermitente": con ping cada 4 s y umbral de 30 s harían falta 8 pérdidas
seguidas, que al 55% ocurre el 0,8% de los ticks. Por eso INTERMITENTE combina
pérdida base del 40% **con apagones de 35-70 s cada 90-180 s**, que garantizan el
ciclo visible y repetido. Al recuperar señal el backlog se vacía en un solo POST
por lote — `postPositionsSchema` ya acepta hasta 200 y hoy esa rama no se
ejercita nunca. Es el mejor argumento visual del "HTTP y no WebSockets".

Mezcla por defecto sobre 18 micros: 11 buena · 4 intermitente · 2 corte · 1 salto
de GPS. Dos reglas: **máximo una micro degradada por empresa** (si las 3 de Paine
se caen, el jurado concluye que la app anda mal con Paine) y **toda micro
degradada comparte corredor con una sana** (la comparación lado a lado es lo que
hace legible la frescura).

**`--seed=17` hace la demo reproducible**: la misma micro se queda muda en el
mismo segundo durante el ensayo y durante la presentación.

### Bugs del simulador a corregir

1. **Reutilización de turno**: adopta el `tripId` viejo pero sigue moviéndose por
   el recorrido nuevo, así que emite posiciones sobre un trazado ajeno. Además
   usa `try/catch`, prohibido por CLAUDE.md — se reemplaza por consultar
   `/trips/active` primero.
2. **Ventana de arranque**: los buses se registran en `busesVivos` *después* de
   iniciar turno. Con 18 micros y login escalonado son ~6 s en los que un Ctrl+C
   deja turnos fantasma `IN_TRANSIT`.
3. **Ticks en vuelo tras el cierre** postean a un turno `COMPLETED` y reciben 409.
4. **Segundo Ctrl+C no hace nada** (`if (cerrando) return`) y el usuario queda
   esperando. Debe forzar salida diciendo qué turnos quedaron abiertos.
5. Falta un modo **`--cleanup`** que cierre turnos huérfanos: hoy la única salida
   tras un `kill -9` es entrar a `prisma studio`.
6. **Al llegar al terminal debe dar la vuelta** (arrancar el sentido contrario),
   no teletransportarse al origen como hace hoy.

### Rate limit: hay que tocarlo

`auth.routes.ts` limita a **30 logins por IP cada 15 min**, compartidos entre
login y register, y los 401 también consumen cupo. Con 18 choferes: primera
corrida 18/30, **segunda corrida 39/30 → 429 a mitad de flota**. Revienta durante
el ensayo o en el reintento en vivo, que es el peor momento posible.

```ts
const AUTH_RATE_LIMIT = isProduction ? 30 : 300;
```

Una constante y un comentario. No usar `skip: () => !isProduction`: eso desactiva
el limitador en dev y en tests, y una regresión llegaría a producción sin que
nadie la note.

## G. Assets: pre-renderizar los sprites

**Los PNG de `Previews/` no sirven rotados.** Medido sobre el cubo de `box.png`:
elevación **31°**, azimut 45°. Uber está a 65–75°. A 31° se ve más costado que
techo, y **al rotar una micro 180° queda con las ruedas para arriba**. El error
es proporcional a `cos(θ)`: 0,86 a 31° contra 0,34 a 65°.

Solución verificada: **pre-renderizar desde los `.glb` a ~62° de elevación**, con
un script en Python puro (0,23 s por frame, sin GPU ni dependencias). El color
está horneado pero es repintable: `colormap.png` es un atlas de 8×4 celdas y la
**fila 1 es la pintura de carrocería** — recolorear una empresa es repintar una
celda de 64×128.

`hue-rotate` queda descartado con evidencia: tiñe cabina, focos y neumáticos, y
no puede producir grises ni cambiar luminosidad.

Del kit se copian **3 GLB + `colormap.png` = 604 KB** a `tools/kenney/` (fuente,
no se sirve) y se publican ~108 KB de sprites generados. Los GLB referencian la
textura por URI externa, así que la carpeta `Textures/` tiene que ir al lado.

**La frescura no se expresa con color**, porque el color ya lo ocupa la empresa y
tener dos significados para lo mismo hace mentir a la interfaz. Se expresa con
tratamiento: `saturate(0.55)` en intermitente, `grayscale(1) opacity(0.55)` en
sin señal. Un dato viejo se *ve* viejo.

**Bug de rendimiento a corregir**: `MapView.jsx` hornea el rumbo dentro de un
`data:image/svg+xml`, o sea genera una URL nueva y fuerza redecodificación de
imagen en cada tick. Al migrar a `AdvancedMarker` el contenido es DOM y basta un
`transform: rotate()` con transición.

### Licencia (requisito de las bases)

Kenney Car Kit 3.1 es **CC0** — atribución apreciada pero no obligatoria. Sin
embargo las bases exigen declarar los assets de terceros, y hoy el `README.md`
raíz **no menciona a Kenney**. Hay que añadirlo, junto con `License.txt` al lado
de los sprites. `LICENSE` (MIT) está correcto e idéntico en las 6 ramas.

## H. Frontend: sprites y datos multi-empresa

- `MapView.jsx`: `Marker` (deprecado) → `AdvancedMarker` con el `mapId` que ya
  está en `.env.example` y hoy no se usa. Contenido: `<img>` del sprite de la
  empresa dentro de una capa que rota, envuelto en otra que **no** rota (el
  anillo de frescura y la etiqueta deben leerse derechos).
- Rotación con `unwrapHeading` acumulado en un `useRef`, para que 358° → 2° gire
  4° y no 356° hacia atrás. Con `heading === null` **no se rota**: orientar al
  norte por defecto sería inventar una dirección de marcha.
- **Solo se anima `LIVE`.** Con `INTERMITTENT` o `NO_SIGNAL` el punto se congela:
  una micro sin señal que sigue deslizándose es una mentira en movimiento.
  **Prohibido extrapolar** más allá del último dato conocido.
- `freshness.js` deja de calcular umbrales propios y consume
  `FRESHNESS_LIVE_MS` / `FRESHNESS_INTERMITTENT_MS` de `@equipo17/shared`, con el
  mismo `<=` que `liveStore.freshnessOf`. Se elimina el `Math.max(minutes, 15)`
  y el `Math.floor(45/60)` que imprime "hace 0 min".
- `MicroCard.jsx`: el badge de ETA en minutos **se elimina** — CLAUDE.md lo
  prohíbe explícitamente. Se reemplaza por `"A 2,3 km"`, y por nada cuando
  `distanceMeters` es `null`.
- `RideSheet.jsx`: arreglar el doble manejo `onClick` + `onPointerUp` (un drag de
  50 px colapsa y luego el click reexpande) y añadir `setPointerCapture`.

---

## I. Producción — que la demo viva en una URL, no en un notebook

La infra ya está desplegada y `terraform output` expone `public_api_url`,
`web_url`, `web_bucket`, `cloudfront_distribution_id`, `ecs_cluster`,
`ecs_service`, `db_endpoint` y `database_url_secret_arn`. Los scripts
`infra/scripts/deploy-api.sh` y `deploy-web.sh` ya existen.

### Lo que ya está resuelto

`apps/api/docker-entrypoint.sh` aplica `prisma migrate deploy` en cada
despliegue y, con **`SEED_DEMO_DATA=true`**, corre `node dist/seed.js`. Como el
seed es idempotente por `upsert`, sembrar en cada arranque no duplica nada. O
sea: **las 8 empresas llegan a RDS solas al desplegar**, sin paso manual.

### Lo que hay que arreglar para producción

1. **El entrypoint se traga los fallos.** `prisma migrate deploy || echo
   "AVISO: fallaron las migraciones, se arranca igual."` — si la migración falla,
   el API arranca con un cliente Prisma desalineado y devuelve 500 en cada
   endpoint tocado, sin que nada lo grite. Con `hydrateLiveTrips()` fallando
   también en silencio, son **dos fallos encadenados que dan un API "sano" con el
   mapa vacío**. Mínimo: que el mensaje diga explícitamente qué queda roto.
2. **`api_desired_count` debe quedarse en 1.** El store de posiciones vive en
   memoria del proceso. Con 2 tareas el chofer pinga a una y el pasajero lee de
   la otra: **medio mapa desaparece sin ningún error**, y las sticky sessions no
   lo arreglan porque escritor y lector son clientes distintos. Documentarlo como
   restricción dura en `variables.tf` y en `CLAUDE.md`: *no subir de 1 sin mover
   el store a Redis*. El incentivo de subirlo crece justo cuando el mapa
   multi-empresa hace el fallo más visible.
3. **Falta compresión.** No hay `compression` en Express, y la behavior `/api/*`
   de CloudFront usa `CachingDisabled` — la compresión al vuelo va acoplada al
   cacheo. El JSON del mapa (~70 KB con 200 micros) probablemente viaja sin
   comprimir cada 5 s sobre señal rural. Comprime ~8:1; es una dependencia.
4. **`deploy-web.sh` vuelve a pnpm** (§A) y necesita pasar los dos `ARG` nuevos
   de Maps, o el bundle de producción sale sin mapa.
5. **`CORS_ORIGIN`** debe incluir el dominio de CloudFront, no solo
   `localhost:5173`.
6. **Restringir la clave de Maps al dominio de CloudFront** además de localhost,
   ahora que va a estar públicamente accesible.

### El simulador en producción

Para que el jurado abra la URL y vea micros moviéndose **sin que nadie tenga el
notebook encendido**, el simulador tiene que correr en la nube. Dos caminos:

| Opción | Costo | Cuándo |
|---|---|---|
| **Desde un notebook** — `API_URL=https://<public_api_url> pnpm --filter @equipo17/api simulate` | Cero infra. Ya funciona: el simulador habla solo HTTP, por diseño | Ensayo y presentación en vivo |
| **Segundo servicio ECS** `miqui-simulator` reusando la misma imagen | Un entry más en `tsup.config.ts` (`simulate: 'tools/simulator/index.ts'`), una task definition y un service Fargate de 0,25 vCPU | Demo siempre encendida |

La segunda es la que corresponde a "todo en producción": añade ~40 líneas de
Terraform y hace que la URL esté viva 24/7. El simulador ya tolera que el API se
caiga (un ping perdido se reintenta al siguiente tick) y cierra los turnos en
`SIGTERM`, que es exactamente lo que ECS envía al reemplazar una tarea.

**Ojo con el rate limit en producción**: el arreglo de §F es
`isProduction ? 30 : 300`, así que en producción siguen siendo 30 logins por 15
min por IP. El simulador en ECS sale por **una sola IP** (la NAT de la subred) y
haría ~18 logins por arranque: cabe una vez, pero un reinicio de la tarea dentro
de la misma ventana lo revienta. Soluciones, en orden de preferencia: que el
simulador **no vuelva a loguearse en cada reinicio** (persistir tokens no sirve
en un contenedor efímero), o exceptuar la IP de la NAT, o subir el cupo cuando
`SIMULATOR_ENABLED=true`. Hay que decidirlo antes de desplegarlo, o la demo se
cae sola a las horas.

### Orden de despliegue

```bash
# 1. API: build, push a ECR, migrar y sembrar
SEED_DEMO_DATA=true ./infra/scripts/deploy-api.sh

# 2. Verificar que la base quedo poblada
curl -s "$(terraform -chdir=infra/terraform output -raw public_api_url)/api/routes" | jq 'length'
curl -s "$(terraform -chdir=infra/terraform output -raw public_api_url)/api/companies" | jq '[.[].name]'

# 3. Web: build con las VITE_* y sync a S3 + invalidacion de CloudFront
./infra/scripts/deploy-web.sh

# 4. Simulador (opcion notebook)
API_URL="$(terraform -chdir=infra/terraform output -raw public_api_url)" \
  BUSES=18 pnpm --filter @equipo17/api simulate -- --seed=17 --wait-for-api
```

**Punto de control de producción**: abrir `web_url` desde un teléfono con datos
móviles (no wifi) y ver micros de al menos 5 empresas moviéndose, con al menos
una en ámbar y una en gris sin distancia. Si funciona en 4G rural, funciona.

---

## Orden de ejecución

```bash
git switch -c feat/simulacion-multiempresa feat/frontend-api
```

**No mergear `map-ui`, `frontend-init` ni `assets/car-kit`.** Las tres salen de
`Initial commit` y su `.gitignore` no añade reglas: **reescribe el archivo
entero**, borrando 39 líneas del de `develop` incluidas `*.tfstate`, `*.tfplan` y
`terraform.tfvars`. El repo ya tiene `infra/terraform/terraform.tfstate` en el
working tree: un merge resuelto a la ligera **commitea el estado de Terraform con
credenciales**. Los assets se extraen con `git archive`, no con merge. Además
`assets/car-kit` es **hermana** de `map-ui`, no descendiente: mergearla
revertiría el bottom sheet colapsable.

| # | Paso | Verificación |
|---|---|---|
| 1 | `frontend/` al workspace pnpm (§A) | `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
| 2 | Contratos en shared (§C) | `pnpm typecheck` **falla a propósito** en `publicRoute.service.ts` y `public.controller.test.ts`: esa lista es el trabajo del paso 4 |
| 3 | Esquema + migración a mano (§B) | `prisma studio` muestra `Fare` y `Bus`; probar el camino incremental sobre base sembrada, no solo `db:reset` |
| 4 | Backend: catálogo, endpoint, store (§D) | `curl 'localhost:3000/api/live/buses' \| jq` trae `company.color`, `assetSlug`, `fareAdultClp` |
| 5 | Tests del backend | Incluidos "NO_SIGNAL nunca encabeza" y "tarifa 0 ≠ tarifa null" con `toBe(0)`/`toBeNull`, no `toBeFalsy` |
| 6 | Seed de 8 empresas + geocodificación con Places (§E) | Correrlo dos veces: mismos totales, cero errores de constraint |
| 7 | Sprites pre-renderizados (§G) | 8 sprites distinguibles sobre mapa claro |
| 8 | Simulador multi-empresa + rate limit (§F) | `curl .../live/buses \| jq '[.buses[].company.name] \| unique'` → ≥5 empresas |
| 9 | Frontend: AdvancedMarker y sprites (§H) | `pnpm dev` + simulador: micros de colores distintos rotando según rumbo |
| 10 | Docs: CLAUDE.md, README (Kenney), openapi.yaml | — |

**El punto de control real** es el paso 9 con `--chaos`: en el mismo mapa tienen
que verse micros pulsando en vivo, alguna en ámbar intermitente y una en gris sin
señal **con la distancia desaparecida**. Si el pin se pone gris pero el texto
sigue en ámbar, los umbrales no quedaron unificados.

## Riesgo para el equipo

Son cuatro personas. Antes de empezar:

- **A Antonio Cáceres**: su `frontend/` pasa a ser el frontend oficial del
  monorepo — su trabajo no se descarta, se promueve. Lo que cambia es el gestor
  de paquetes y de dónde salen las constantes. Avisarle de los tres cambios de
  producto: se va el badge de ETA, baja el umbral intermitente de 5 min a 2 min,
  y el color pasa a significar empresa en vez de frescura.
- **A jttvttj**: se traen solo 3 GLB + textura en vez de los 13,5 MB, y se
  pre-renderizan sprites propios en vez de usar los `Previews/`. La razón es
  medible: los previews están a 31° y al rotarlos las micros quedan de cabeza.
  Su `origin/assets/car-kit` se deja viva para recuperar el resto.
- **Todo va por PR a una rama `feat/`, nunca push directo a `develop`.**
