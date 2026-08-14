# Build desde la RAIZ del repo:
#   docker build -f apps/web/Dockerfile -t equipo17-web .
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --filter @equipo17/web... --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/web apps/web

# Vite congela las VITE_* en tiempo de build. Vacio = rutas relativas /api,
# que en este contenedor resuelve el proxy de nginx.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @equipo17/web build

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
