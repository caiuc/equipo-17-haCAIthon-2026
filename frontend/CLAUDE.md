# Frontend

Proyecto React (Vite) del equipo: el paquete `@equipo17/web` del monorepo.

**Gestor de paquetes: pnpm**, como el resto del repo. Vive en `frontend/` y no
bajo `apps/` por razones historicas (nacio en una rama propia), pero es un
workspace mas: por eso puede importar `@equipo17/shared`, que es el contrato
unico con el backend. Los umbrales de frescura y los intervalos de polling se
importan de ahi y **nunca** se copian a mano — si divergen, la interfaz miente.

## Stack

- React 19 + Vite
- **Tailwind CSS v4** (config CSS-first en `src/index.css`, sin `tailwind.config.js`)
- **shadcn/ui** para componentes (`src/components/ui/`), tema `neutral`, iconos `lucide-react`
- **Google Maps** via `@vis.gl/react-google-maps`. `AdvancedMarker` exige un
  `mapId`: sin el, los sprites de las micros no pueden rotar segun su rumbo.
- Alias de import `@/*` → `src/*` (ver `jsconfig.json` y `vite.config.js`)

## Reglas de estilo

- Todo el UI se construye con **Tailwind** (clases utilitarias). Evitar CSS custom salvo que Tailwind no lo resuelva.
- Para componentes de UI (botones, inputs, modales, dropdowns, etc.), preferir siempre **shadcn/ui** antes de crear uno desde cero:
  ```bash
  pnpm --filter @equipo17/web dlx shadcn@latest add <componente>
  ```
- No instalar librerías de componentes adicionales (MUI, Chakra, Bootstrap, etc.) sin acordarlo con el equipo.

## Clean code

- Componentes pequeños y con una sola responsabilidad. Si un componente crece mucho, separarlo.
- Nombres descriptivos para componentes, funciones y variables (nada de `data2`, `handleClick1`, etc.).
- Sin código muerto, imports sin usar, ni console.log de debug en el código final.
- Extraer lógica repetida a hooks o funciones utilitarias en `src/lib/`.
- Props explícitas y tipadas por convención de nombre (evitar pasar objetos gigantes cuando basta con los campos necesarios).
- Mantener la carpeta `src/components/ui/` intacta (autogenerada por shadcn); el código propio va en `src/components/` u otras carpetas fuera de `ui/`.

## Comandos

Todos desde la raiz del repo:

```bash
pnpm install                          # instala todo el workspace
pnpm --filter @equipo17/web dev       # desarrollo (http://localhost:5173)
pnpm --filter @equipo17/web build     # build de produccion
pnpm lint                             # eslint, cubre todo el repo
```

`pnpm dev` en la raiz levanta el API (3000) y el front (5173) en paralelo.

## Variables de entorno

En `frontend/.env` (gitignoreado, ver `.env.example`):

```bash
VITE_GOOGLE_MAPS_API_KEY=   # clave de Maps JavaScript API
VITE_GOOGLE_MAPS_MAP_ID=    # Map ID vectorial; lo exige AdvancedMarker
```

Una variable `VITE_*` se hornea como string literal dentro del bundle: es
publica por definicion. No se protege ocultandola sino restringiendola por
referrer HTTP en la consola de Google Cloud.
