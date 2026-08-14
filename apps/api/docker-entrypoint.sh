#!/bin/sh
set -e

# Aplica las migraciones pendientes antes de arrancar.
# En ECS esto corre en cada despliegue; `migrate deploy` es idempotente.
if [ -n "$DATABASE_URL" ]; then
  echo "Aplicando migraciones de Prisma..."
  ./node_modules/.bin/prisma migrate deploy || echo "AVISO: fallaron las migraciones, se arranca igual."

  # El seed es idempotente (upsert), asi que correrlo en cada despliegue no duplica nada.
  if [ "$SEED_DEMO_DATA" = "true" ]; then
    echo "Sembrando datos de demo..."
    node dist/seed.js || echo "AVISO: fallo el seed, se arranca igual."
  fi
fi

exec "$@"
