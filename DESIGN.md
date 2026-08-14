# Design Doc — Plataforma de micros rurales

> Este documento complementa el [documento de requerimientos](./README.md) del equipo:
> define *cómo* vamos a construir lo que ahí se pide. Se actualiza a medida que
> avanza el hackathon; las decisiones que cambian se tachan, no se borran.

## 1. Problema (resumen)

En sectores rurales las micros no siguen horarios confiables y quien espera en el
paradero no tiene forma de saber si el bus ya pasó, cuánto falta, o si viene.
Construimos una plataforma donde los choferes transmiten su ubicación y los
pasajeros consultan el estado real del servicio.

**Principio rector:** nunca mostrar una posición sin declarar qué tan vieja es.

## 2. Objetivo de la demo (17:10 hoy)

Dejar funcionando, con datos seed si el backend real no alcanza a tiempo:

- Vista de pasajero: mapa + lista de micros en ruta, con estado de frescura visible.
- Vista de chofer: iniciar/finalizar turno, transmitir ubicación.
- Dashboard de empresa: registrar recorrido, paraderos y choferes.

**No-objetivos** (explícitamente fuera de alcance, ver §7 del doc de requerimientos):
app nativa, transmisión en segundo plano, IoT, pagos, integración GTFS, ETA con
modelos históricos.

## 3. Actores y flujos

| Actor | Flujo principal |
|---|---|
| Pasajero | Busca recorrido → ve mapa con micros activas → ve frescura + ETA → (opcional) elige paradero |
| Chofer | Login → elige recorrido → inicia turno → transmite posición → finaliza turno |
| Empresa | Login → dashboard → registra recorridos/paraderos/choferes → ve micros propias en vivo |
| Admin | Diferido — no se implementa para la demo (empresas pre-aprobadas) |

## 4. Arquitectura general

```
┌─────────────┐        HTTPS/REST        ┌──────────────┐
│  Frontend    │ ───────────────────────▶ │  API (Express)│
│  React+Vite  │ ◀─────────────────────── │  + Prisma     │
└─────┬───────┘                           └──────┬───────┘
      │                                          │
      │ Maps JS API                              │
      ▼                                          ▼
┌─────────────┐                           ┌──────────────┐
│ Google Maps  │                           │  PostgreSQL   │
└─────────────┘                           └──────────────┘
```

- **Frontend**: SPA en `frontend/` (Vite + React 19 + Tailwind v4 + shadcn/ui),
  con rutas separadas por actor (`/`, `/app` pasajero, `/chofer`, `/empresa`).
  Ver [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) para convenciones de estilo.
- **Backend**: Express + Prisma + PostgreSQL, scaffolded en la rama `develop`
  (`apps/api/`). **Estado actual: solo scaffold**, sin modelos de dominio reales
  (el `schema.prisma` todavía tiene la entidad de ejemplo `Item`).
- **Infra**: Terraform para ECS + RDS + ECR en AWS, también en `develop`
  (`infra/terraform/`). Para la demo probablemente alcance con correr todo local
  o en un servicio gratuito (Render/Railway) en vez de levantar AWS completo.
- **Mapa**: Google Maps JavaScript API vía `@vis.gl/react-google-maps`. Requiere
  `VITE_GOOGLE_MAPS_API_KEY` en `.env` (no versionado).

### 4.1 Nota importante sobre las ramas

Hay **dos scaffolds de frontend divergentes** en el repo:

- `main` / `map-ui`: `frontend/` standalone, yarn, el que estamos construyendo.
- `develop`: monorepo `apps/web` + `apps/api`, pnpm, generado por otro punto de partida.

Antes de mergear hacia `main`, el equipo debe decidir cuál estructura se queda
(recomendado: quedarnos con `frontend/` + agregar `apps/api` de `develop` como
carpeta hermana, no como monorepo pnpm, para no reescribir lo ya avanzado).

## 5. Modelo de datos

Basado en §6 del doc de requerimientos:

```
Empresa       (id, nombre, estado_validacion)
Usuario       (id, email, password_hash, rol[pasajero|chofer|empresa|admin], empresa_id?)
Recorrido     (id, empresa_id, nombre, origen, destino)
Paradero      (id, recorrido_id, nombre, lat, lng, orden)
Turno         (id, chofer_id, recorrido_id, inicio, fin?, activo)
Posicion      (id, turno_id, lat, lng, timestamp)   ← el timestamp habilita §4.5
Favorito      (id, usuario_id, recorrido_id)
```

`Posicion.timestamp` es el dato central: todo cálculo de frescura y ETA parte de ahí.

## 6. Contrato de API (propuesto, aún no implementado en `develop`)

```
GET  /recorridos?query=          → buscar recorridos (público)
GET  /recorridos/:id/micros      → micros activas + última posición (público)
GET  /recorridos/:id/paraderos   → paraderos ordenados (público)

POST /auth/login                 → chofer/empresa
POST /turnos                     → iniciar turno (auth chofer)
PATCH /turnos/:id/finalizar      → finalizar turno (auth chofer)
POST /turnos/:id/posiciones      → reportar posición (auth chofer, alta frecuencia)

GET  /empresa/recorridos         → CRUD recorridos (auth empresa)
POST /empresa/recorridos
POST /empresa/recorridos/:id/paraderos
POST /empresa/choferes
```

Todas las rutas privadas devuelven 401/403 sin exponer detalle interno (§5.1).
El frontend ya está preparado para consumir esto — hoy usa `src/lib/mockData.js`
como reemplazo directo del `GET /recorridos/:id/micros`.

## 7. Estados de frescura (§4.5 — ya implementado en frontend)

Implementado en `frontend/src/lib/freshness.js`:

| Estado | Umbral | Color |
|---|---|---|
| En vivo | < 30 seg | verde |
| Señal intermitente | 30 seg – 5 min | ámbar |
| Sin señal | 5 – 15+ min, turno activo | rojo |
| Fuera de servicio | sin turno activo | gris |

Los umbrales son ajustables en un solo lugar; se recalculan en el cliente a partir
del timestamp crudo, no confían en una etiqueta pre-calculada del backend.

## 8. Decisiones tomadas

- **ETA**: distancia en línea recta desde la posición actual al paradero, dividida
  por velocidad promedio reciente. Descartamos proyección sobre trazado real por
  tiempo — requeriría tener el polyline de cada ruta, no solo paraderos.
- **Mapa**: Google Maps JS API (Marker clásico, no AdvancedMarker — este último
  choca con `StrictMode` de React 19 en dev, ver commit `9a25ac7`).
- **Micros simultáneas**: sí, un recorrido puede tener varias micros a la vez →
  el pasajero ve una lista, no una sola micro (ya reflejado en el mockup).

## 9. Decisiones abiertas

- **Alta de choferes**: ¿la empresa crea la cuenta completa o genera código de
  invitación? → afecta el flujo de "Registrar choferes" del dashboard de empresa.
- **Persistencia de favoritos sin cuenta**: localStorage vs. cuenta obligatoria.
- **Dónde correr el backend para la demo**: AWS real (terraform ya existe en
  `develop`) vs. un deploy rápido tipo Railway/Render para no perder tiempo con infra.

## 10. Riesgos conocidos

- La transmisión del chofer solo funciona con la app en primer plano y pantalla
  activa — limitación conocida del navegador, se documenta como tal, no como falla.
- Conexión pobre en zona rural: la vista de pasajero debe cargar y ser legible
  igual (NFR §5). El mockup actual ya degrada bien si falta la API key de Maps
  (placeholder visual en vez de crashear).
- Node del equipo debe ser ≥21.7 (Vite/rolldown lo requieren) — ver `.nvmrc` en
  `frontend/`. Si alguien usa `nvm` con default en una versión vieja, el `yarn dev`
  falla con un error de módulo poco claro.

## 11. Estado actual (actualizar a medida que se avanza)

- [x] Landing page (`main`/`map-ui`)
- [x] Mockup vista pasajero: mapa + lista de micros + estados de frescura (datos seed)
- [ ] Vista chofer (iniciar/finalizar turno, transmisión)
- [ ] Dashboard empresa (CRUD recorridos/paraderos/choferes)
- [ ] Backend real (modelos de dominio en Prisma, endpoints del §6)
- [ ] Integración frontend ↔ backend real (reemplazar `mockData.js`)
