# Build desde la RAIZ del repo:
#   docker build -f frontend/Dockerfile -t equipo17-web .
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
RUN pnpm install --filter @equipo17/web... --frozen-lockfile

COPY packages/shared packages/shared
COPY frontend frontend

# Vite congela las VITE_* en tiempo de build. VITE_API_URL vacio = rutas
# relativas /api, que en este contenedor resuelve el proxy de nginx.
#
# La clave de Maps queda como string literal dentro del bundle: es publica por
# definicion y no se protege ocultandola, sino restringiendola por referrer HTTP
# en la consola de Google Cloud.
ARG VITE_API_URL=""
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_GOOGLE_MAPS_MAP_ID=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_MAP_ID=$VITE_GOOGLE_MAPS_MAP_ID
RUN pnpm --filter @equipo17/web build

FROM nginx:alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80
