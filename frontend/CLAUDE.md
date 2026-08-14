# Frontend

Proyecto React (Vite) del equipo. Usa **yarn** como gestor de paquetes — no usar npm ni pnpm en esta carpeta.

## Stack

- React 19 + Vite
- **Tailwind CSS v4** (config CSS-first en `src/index.css`, sin `tailwind.config.js`)
- **shadcn/ui** para componentes (`src/components/ui/`), tema `neutral`, iconos `lucide-react`
- Alias de import `@/*` → `src/*` (ver `jsconfig.json` y `vite.config.js`)

## Reglas de estilo

- Todo el UI se construye con **Tailwind** (clases utilitarias). Evitar CSS custom salvo que Tailwind no lo resuelva.
- Para componentes de UI (botones, inputs, modales, dropdowns, etc.), preferir siempre **shadcn/ui** antes de crear uno desde cero:
  ```bash
  yarn dlx shadcn@latest add <componente>
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

```bash
yarn install   # instalar dependencias
yarn dev       # desarrollo (http://localhost:5173)
yarn build     # build de producción
yarn lint      # lint con oxlint
```
