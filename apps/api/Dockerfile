# Build desde la RAIZ del repo (necesita el workspace completo):
#   docker build -f apps/api/Dockerfile -t equipo17-api .
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
WORKDIR /repo

# ---- deps + build ----
FROM base AS build

# Primero solo los manifiestos: esta capa se cachea mientras no cambien.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --filter @equipo17/api... --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api

# tsup empaqueta @equipo17/shared dentro del bundle.
RUN pnpm --filter @equipo17/api build

# Poda las devDependencies y recien despues genera el cliente de Prisma:
# al revés, la poda borraria node_modules con el cliente ya generado dentro.
RUN pnpm install --filter @equipo17/api... --prod --frozen-lockfile --ignore-scripts \
  && pnpm --filter @equipo17/api exec prisma generate

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /repo/apps/api
EXPOSE 3000
USER node
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
