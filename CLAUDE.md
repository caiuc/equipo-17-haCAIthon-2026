# CLAUDE.md — Seguimiento de micros rurales

Documento de trabajo del equipo 17. Breve a proposito.

## El problema

En zonas rurales de Chile nadie sabe si la micro ya paso. No hay pantallas en el
paradero, la frecuencia es de 20-40 minutos y el horario impreso es referencial.
La gente espera sin informacion: puede que el bus venga en 3 minutos o que haya
pasado hace 15 y toque esperar media hora.

La app responde una sola pregunta, bien: **¿viene o no viene?**

## Principio rector

> **Nunca mostrar informacion sin declarar que tan vieja es.**

Toda posicion viaja con `recordedAt`, `ageSeconds` y `freshness`
(`LIVE` / `INTERMITTENT` / `NO_SIGNAL` / `OUT_OF_SERVICE`). Los umbrales viven en
`packages/shared/src/constants.ts` y los comparten backend y frontend: si
divergen, la interfaz miente. Cuando la frescura es `NO_SIGNAL` no se calcula
distancia — un dato viejo presentado como fresco es peor que no tener dato.

## Stack

- **Backend**: Node 20+, Express 5, TypeScript, Prisma, PostgreSQL, zod, JWT.
- **Frontend**: React + Vite.
- **Compartido**: `@equipo17/shared` (schemas zod + constantes) es el contrato
  unico entre api y web.
- **Monorepo**: pnpm workspaces.

## Estructura

```
apps/api          Express 5 + Prisma
  prisma/         schema.prisma, migrations, seed.ts
  src/routes/     routers por rol (public, auth, driver, company, admin, trips)
  src/controllers finos: leen el request y delegan
  src/services/   la logica; no conocen Request/Response
  src/middlewares auth, validate (zod), error
  tools/          simulator.ts (choferes falsos para la demo)
apps/web          React + Vite
packages/shared   schemas zod y constantes compartidas
```

## Comandos

```bash
pnpm install
pnpm db:up                            # Postgres en Docker
pnpm db:migrate                       # prisma migrate dev
pnpm --filter @equipo17/api seed      # datos reales de Bupesa + usuarios demo
pnpm dev                              # api (3000) + web (5173) en paralelo
pnpm --filter @equipo17/api simulate  # micros falsas moviendose por el mapa
pnpm test / pnpm typecheck / pnpm lint
```

Simulador: `BUSES=2 API_URL=http://localhost:3000 pnpm --filter @equipo17/api
simulate`. Con `-- --drop-signal` una micro deja de transmitir a los ~40 s para
mostrar en vivo la degradacion En vivo → Senal intermitente → Sin senal.

Usuarios del seed (clave `demo1234`): `superadmin@demo.cl`, `admin@bupesa.cl`,
`chofer1..6@<empresa>.cl`, `pasajero@demo.cl`.

**Choferes reservados para personas: `chofer5` y `chofer6` de cada empresa.** El
simulador usa unicamente `chofer1..4` y esas dos cuentas no las toca nunca. La
razon no es de estilo: el simulador adopta el turno activo del chofer con el que
entra y lo cierra al llegar al terminal, asi que si compartiera cuenta con una
persona que esta usando `/chofer` desde el telefono, un reinicio del servicio le
cortaria la transmision sin aviso. Para probar la app del chofer, usar
`chofer5@<empresa>.cl` o `chofer6@<empresa>.cl`. El tope de micros del simulador
queda en 4 x empresas (32 con las 8 del seed).

## Superficie del API por rol

| Rol                 | Rutas                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publico (sin token) | `GET /api/live/buses?bbox=&companyId=&routeId=&stopId=&limit=`, `GET /api/companies`, `GET /api/routes?q=`, `GET /api/routes/:id`, `GET /api/routes/:id/live?stopId=`, `GET /api/health`, `GET /api/openapi.yaml` |
| Cualquiera          | `POST /api/auth/register` (solo pasajeros), `POST /api/auth/login`, `GET /api/auth/me`                                                                                     |
| Pasajero            | `POST /api/trips/:id/occupancy` (reporte colaborativo)                                                                                                                     |
| Chofer              | `GET /api/driver/routes`, `POST /api/driver/trips/start`, `POST /api/driver/trips/:id/positions`, `POST /api/driver/trips/:id/end`, `POST /api/driver/trips/:id/occupancy` |
| Admin de empresa    | `/api/company/routes`, `/api/company/routes/:id/stops`, `/api/company/routes/:id/schedules`, `/api/company/drivers`                                                        |
| Superadmin          | `/api/admin/companies`                                                                                                                                                     |

`GET /api/live/buses` es el endpoint del mapa: todas las micros vivas de todas las
empresas en un solo poll. El `bbox` va en orden **`minLng,minLat,maxLng,maxLat`**
(OGC/GeoJSON, o sea oeste,sur,este,norte). Invertirlo devuelve un mapa vacio sin
error: por eso se valida en vez de corregir en silencio.

## Escalado: el API corre en UNA sola tarea

`api_desired_count` no puede pasar de 1, y no es prudencia sino una restriccion de la
arquitectura. La ultima posicion de cada micro vive en un Map en memoria del proceso
(`src/services/liveStore.ts`). Con dos tareas detras del balanceador, el chofer postea
a una y el pasajero lee de la otra: **medio mapa desaparece sin ningun error, sin 500
y sin log**, y se ve igual que "esas micros no estan transmitiendo" — justo la mentira
que el principio rector prohibe. Las sticky sessions no lo arreglan: pegan a cada
cliente con una tarea, pero el escritor (telefono del chofer) y el lector (telefono
del pasajero) son clientes distintos.

Para escalar hay que mover el store fuera del proceso primero (Redis o DynamoDB con
TTL) y recien despues subir la variable. Hay un `validation` en
`infra/terraform/variables.tf` que bloquea el `apply` mientras tanto. Ojo con el
incentivo: el mapa multiempresa hace el fallo mas visible, y ante un mapa con menos
micros de las esperadas la reaccion natural es "subamos a 2 tareas", que lo empeora.

## Decisiones de diseno (y por que)

- **HTTP polling, no WebSockets.** La senal rural se corta. Un socket abierto
  obliga a manejar reconexion y estado de sesion; un `POST` que falla se
  reintenta solo en el siguiente tick y no arrastra nada. El chofer emite cada
  `DRIVER_PING_INTERVAL_MS`, el pasajero consulta cada `LIVE_POLL_INTERVAL_MS`.
- **Sin ETA en minutos: solo distancia en linea recta al paradero.** No
  modelamos subida de pasajeros, paradas a la sena ni el trazado real del camino.
  Un ETA calculado sobre eso estaria malo, y un ETA malo genera confianza falsa
  — justo lo contrario del principio rector. "A 2,3 km, hace 12 s" es honesto.
- **Cada sentido es un recorrido propio.** Asi los publica la empresa (el PDF de
  Bupesa lista "desde Terminal Penaflor" y "desde Terminal San Borja" como
  tablas distintas) y asi los busca el pasajero, que quiere ir en una direccion.
  Evita todo el estado de "en que sentido va esta micro".
- **Ultima posicion en memoria, muestreo a Postgres.** El polling de los
  pasajeros no golpea la base; a `Position` baja una muestra cada
  `POSITION_SAMPLE_INTERVAL_MS`. El store se rehidrata al arrancar para que un
  reinicio no borre las micros en curso.
- **Favoritos en localStorage.** El caso de uso es alguien apurado en un
  paradero: obligarlo a crearse una cuenta para marcar su recorrido lo pierde.
- **El reporte de ocupacion del chofer manda sobre el de los pasajeros.** El
  chofer ve el bus; los pasajeros votan desde afuera. Los votos de pasajeros
  necesitan `OCCUPANCY_FULL_THRESHOLD` para valer, el del chofer vale solo.
- **Paraderos: los carga la empresa, no vienen sembrados.** El PDF de horarios
  no trae coordenadas. Los del seed son aproximados y estan marcados como tales
  en `apps/api/prisma/seed.ts`.

## Convenciones del codigo

- Express 5 propaga solo los errores async: **nada de `try/catch` ni
  `next(err)`**. Se lanza `new HttpError(status, mensaje)`.
- Controladores finos, logica en el service. El service no conoce
  `Request`/`Response`.
- Validacion con zod en el borde (`validateBody` / `validateQuery` /
  `validateParams`); en el controlador se lee con `validatedBody(req)` /
  `validatedQuery(res)` / `validatedParams(res)`.
- Imports relativos **siempre con extension `.js`** (ESM).
- Prisma se importa de `src/lib/prisma.js`.
- Tests con vitest + supertest y Prisma mockeado
  (`vi.hoisted` + `vi.mock('../lib/prisma.js')` + `await import('../app.js')`).
- Comentarios en espanol **sin tildes**, y solo donde expliquen el _porque_.
