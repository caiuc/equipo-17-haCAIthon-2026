# Filtros (empresa, región/zona) y favoritos locales — diseño

Rama: `feat/filtros-y-favoritos`, desde `feat/simulacion-multiempresa`.

## Contexto

`/app` (vista de pasajero) no tiene forma de acotar la búsqueda de recorridos
más allá de texto libre (`GET /api/routes?q=`). El backend ya expone
`GET /api/companies` pero el frontend nunca lo consume. No existe ningún
concepto de zona geográfica en el modelo de datos: `Company` no lo tiene, y
asociarlo a la empresa sería incorrecto porque una empresa puede operar en más
de una zona (decisión explícita del equipo). Tampoco existen favoritos: solo
hay un comentario en `frontend/src/lib/api.js` que los menciona como plan
futuro.

La vista de chofer (login, iniciar/finalizar recorrido) la trabaja otro
integrante en paralelo — **queda fuera de este alcance** para evitar choques
de merge; se retoma después de integrar esa rama.

## Decisiones tomadas

1. **La zona vive en `Route`, no en `Company`.** Jerárquica: `Region` → `Zone`
   → `Route.zoneId` (opcional). Ausencia de zona es "pendiente", nunca se
   infiere.
2. **`Region`/`Zone` son tablas, no strings libres en `Route`.** Evita que
   "Talagante" escrito por dos empresas quede como dos valores que no calzan
   al filtrar. Cualquier empresa puede crear una zona nueva desde el
   `RouteForm` (combobox "buscar o crear"), pero el alta hace upsert
   case-insensitive: nunca duplica una zona existente.
3. **Se siembran con las comunas reales de la Región Metropolitana**, porque
   el seed ya tiene 8 empresas rurales de la RM — evita selectores vacíos en
   la demo.
4. **Favoritos, en este alcance, son solo locales** (`localStorage`, mismo
   patrón que el `deviceId` de voto de ocupación). Favoritos con cuenta de
   pasajero (que requiere login de pasajero, hoy inexistente en `/app`) queda
   **planificado pero no implementado**, retomado tras el merge de la vista de
   chofer.
5. **Favorito = `Route`**, no empresa ni viaje/trip (las micros son efímeras).
6. **Multi-select en empresa, single-select en región→zona.** Tiene sentido
   comparar 2-3 empresas a la vez; el pasajero suele estar en un solo lugar.
7. Los filtros nunca bloquean la búsqueda por texto: si `/api/regions` o
   `/api/companies` fallan, la hoja de filtros lo declara pero el buscador
   principal sigue funcionando. El principio rector del proyecto
   ("¿viene o no viene?") no depende de que los filtros carguen.

## A. Esquema Prisma

```prisma
model Region {
  id    String @id @default(cuid())
  name  String @unique
  zones Zone[]
}

model Zone {
  id       String @id @default(cuid())
  regionId String
  name     String
  region   Region  @relation(fields: [regionId], references: [id], onDelete: Cascade)
  routes   Route[]
  @@unique([regionId, name])
}
```

`Route` gana `zoneId String?` + relación `zone Zone? @relation(fields: [zoneId], references: [id], onDelete: SetNull)`.
`onDelete: SetNull` porque borrar una zona no debe borrar los recorridos que
la usaban — vuelven a "zona pendiente", no desaparecen.

### Seed

`prisma/seed/data/regions.ts` (sin side effects, igual que el resto de
`data/**`): `Region Metropolitana` con las comunas donde operan las 8
empresas (Talagante, Peñaflor, Paine, Colina, Til Til, Padre Hurtado, Isla de
Maipo, etc. — se derivan de `originName`/`destinationName` ya sembrados). El
`index.ts` del seed hace upsert de regiones/zonas antes de los recorridos, y
cada `RouteSeed` gana un campo `zoneSlug` opcional para asignarse durante el
upsert.

## B. Contratos en `packages/shared`

- `region.ts` nuevo: `zoneSchema` (`id`, `name`), `regionSchema` (`id`, `name`,
  `zones: zoneSchema.array()`), `regionTreeSchema` = `regionSchema.array()`.
- `route.ts`: `routeBriefSchema`/`routeSchema` ganan `zone: zoneSchema.nullable()`.
- `searchRoutesQuerySchema` (o el que valide `GET /api/routes`) gana
  `companyId: z.string().array().optional()` (query repetible) y
  `zoneId: z.string().optional()`.
- `createZoneSchema`: `{ name: z.string().min(1).max(80) }`.

## C. Backend

**Público:**
- `GET /api/regions` → árbol completo, cacheable (TTL corto tipo el catálogo
  de empresas, cambia poco). `regions.controller.ts` + `regions.service.ts`
  nuevos, montados en `publicRouter` sin prefijo (mismo patrón que
  `public.routes.ts`).
- `GET /api/companies` — ya existe (`listPublicCompanies`), sin cambios.
- `GET /api/routes?q=&companyId=&companyId=&zoneId=` — extiende
  `publicRoute.service.ts::searchRoutes`. Todos los filtros opcionales, AND
  entre ellos. `companyId` repetido en query string = OR entre empresas,
  AND con el resto.

**Panel de empresa** (requiere auth, rol `COMPANY_ADMIN`):
- `GET /api/regions` — mismo endpoint público, reusado para el selector.
- `POST /api/regions/:regionId/zones` `{name}` → busca case-insensitive
  dentro de la región; si existe la devuelve (200), si no la crea (201). Nunca
  duplica. 404 si `regionId` no existe.
- `company.controller.ts::createRoute`/`updateRoute`: el body acepta
  `zoneId` opcional; si viene y no existe una `Zone` con ese id, 400 (nunca se
  guarda un `Route` apuntando a una zona fantasma).

**Migración:** `ADD COLUMN "zoneId"` nullable, sin default necesario (a
diferencia de `Company.slug` en el otro spec, acá no hay backfill: todo
recorrido existente queda con zona pendiente hasta que la empresa la asigne).

## D. Frontend — pasajero

- `frontend/src/hooks/useCompanies.js`: consume `GET /api/companies` (nuevo
  en `api.js`: `export const listCompanies = () => request("/api/companies")`).
- `frontend/src/hooks/useRegions.js`: consume `GET /api/regions`.
- `frontend/src/hooks/useFavorites.js`: `Set<routeId>` en
  `localStorage["miqui.favorites"]`, expone `isFavorite(routeId)`,
  `toggleFavorite(routeId)`. Mismo patrón que `getDeviceId` en `api.js`.
- `useRouteSearch` se extiende para aceptar `{ q, companyIds, zoneId }` y
  arma la query string acorde (o se agrega un hook paralelo si mezclar
  ensucia la firma actual — decisión de implementación, no de diseño).
- `PassengerApp.jsx`: nuevo estado `selectedCompanyIds`, `selectedZoneId`,
  `favoritesOnly`, `filtersOpen`. Fila de chips debajo del buscador (uno por
  empresa elegida, uno de zona, uno de "★ favoritos"), cada uno con `×`.
  Botón "Filtros" abre una `Sheet` (shadcn, mismo patrón que `RideSheet`) con:
  - checkboxes de empresa (de `useCompanies`)
  - dos `select` encadenados región → zona (de `useRegions`)
  - toggle "Solo favoritos"
  - "Limpiar" / "Aplicar"
- Estrella (`lucide-react` `Star`) en cada fila de resultados de búsqueda,
  rellena si `isFavorite(item.id)`. `favoritesOnly` filtra client-side sobre
  `routes` — no se manda al backend, porque los favoritos viven solo en el
  dispositivo.
- Errores de `useCompanies`/`useRegions` se muestran dentro de la hoja de
  filtros, sin bloquear el buscador principal.

## E. Panel de empresa

- `RouteForm.jsx`: nuevo campo "Zona" — combobox con búsqueda sobre
  `useRegions()` aplanado (`region.name / zone.name`). Si no hay coincidencia,
  opción "Crear '<texto>'" que llama `POST /api/regions/:regionId/zones` (con
  la región elegida primero) y selecciona la zona recién creada. Campo
  opcional: guardar sin zona es válido.

## Fuera de alcance (explícitamente pendiente)

- Login/registro de pasajero en `/app`.
- Favoritos sincronizados a cuenta de pasajero (backend: tabla
  `FavoriteRoute` con `userId`+`routeId`, merge de favoritos locales al
  iniciar sesión).
- Vista de chofer (login, iniciar/finalizar recorrido, marcar ocupación desde
  esa vista) — la trabaja otro integrante en paralelo.

## Testing

**Backend** (Vitest, patrón `public.controller.test.ts`):
- `regions.controller.test.ts`: `GET /api/regions` devuelve el árbol
  correcto; `POST /api/regions/:id/zones` es idempotente (crear "Talagante"
  dos veces devuelve la misma fila) y rechaza nombre vacío; 404 con
  `regionId` inexistente.
- `public.controller.test.ts` (extendido): `searchRoutes` con `companyId`
  múltiple, con `zoneId`, y combinado con `q`. Caso explícito: un recorrido
  sin `zoneId` **nunca aparece** al filtrar por una zona.
- `company.controller.test.ts` (extendido): `createRoute`/`updateRoute`
  aceptan `zoneId` opcional; 400 si la zona no existe.

**Frontend** (se agrega Vitest + Testing Library al workspace `frontend`,
hoy no existe ningún test):
- `useFavorites.test.js`: toggle, persistencia en `localStorage` mockeado,
  no revienta con `localStorage` vacío o corrupto.
- Hook de búsqueda filtrada: arma la query string correctamente con
  combinaciones de `companyIds`/`zoneId`/`q` (mock de `fetch`).
- Componente de hoja de filtros: marcar 2 empresas + 1 zona genera 3 chips;
  "Limpiar" los quita todos.

**QA manual:** con el seed sembrado, filtrar por "Talagante" trae solo
recorridos de empresas que efectivamente pasan por ahí (el caso real que
motivó no asociar zona a empresa).
