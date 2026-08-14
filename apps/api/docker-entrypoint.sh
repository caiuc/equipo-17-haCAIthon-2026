#!/bin/sh
set -e

# Aplica las migraciones pendientes antes de arrancar.
# En ECS esto corre en cada despliegue; `migrate deploy` es idempotente.
if [ -n "$DATABASE_URL" ]; then
  echo "Aplicando migraciones de Prisma..."
  ./node_modules/.bin/prisma migrate deploy || echo "AVISO: fallaron las migraciones, se arranca igual."
fi

exec "$@"
