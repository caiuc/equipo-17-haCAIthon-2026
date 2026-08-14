#!/bin/sh
set -e

# Bloque de aviso reconocible de un vistazo en los logs de ECS: en CloudWatch cada
# linea es una fila suelta, asi que un "AVISO:" de una linea entre cien lineas de
# arranque no lo ve nadie. Buscar "DESPLIEGUE DEGRADADO" en /ecs/<proyecto>-api.
aviso() {
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "!! DESPLIEGUE DEGRADADO"
  for linea in "$@"; do
    echo "!! $linea"
  done
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
}

# Aplica las migraciones pendientes antes de arrancar.
# En ECS esto corre en cada despliegue; `migrate deploy` es idempotente.
if [ -n "$DATABASE_URL" ]; then
  echo "Aplicando migraciones de Prisma..."

  # Si la migracion falla, la tarea muere en vez de arrancar. Antes esto era un
  # `|| echo AVISO` y el API levantaba igual con un cliente Prisma que no calzaba
  # con el esquema: /api/health solo hace SELECT 1, asi que el ALB la veia sana
  # mientras cada endpoint devolvia 500. Muriendo aqui, ECS no la mete al target
  # group y la tarea anterior sigue sirviendo: un despliegue roto no reemplaza a
  # uno bueno.
  #
  # El precio esta en el PRIMER despliegue: sin tarea anterior que sirva, esto es
  # el servicio entero abajo en vez de un API degradado. Es el intercambio elegido
  # a proposito: un mapa vacio que responde 200 es peor que una URL que no carga,
  # porque el jurado lo lee como "no hay micros" y nadie se entera del fallo.
  if ! ./node_modules/.bin/prisma migrate deploy; then
    aviso \
      "Fallaron las migraciones de Prisma. La tarea NO arranca, a proposito." \
      "" \
      "Que quedaria roto si arrancara: el cliente de Prisma no calza con el" \
      "esquema, asi que todo endpoint que toque una tabla o columna nueva" \
      "responde 500, y el mapa se ve vacio sin ningun error visible." \
      "" \
      "Efecto real: ECS reintenta la tarea en bucle y el despliegue no estabiliza." \
      "Si habia una tarea anterior sana, esa sigue sirviendo. Si es el primer" \
      "despliegue, el ALB devuelve 503 hasta que se corrija." \
      "" \
      "Que hacer: leer el error de arriba, y comprobar el estado con" \
      "  pnpm --filter @equipo17/api exec prisma migrate status" \
      "contra la misma DATABASE_URL. Corregir y volver a lanzar deploy-api.sh."
    exit 1
  fi

  # El seed es idempotente (upsert), asi que correrlo en cada despliegue no duplica
  # nada. Este si es tolerante: son datos de demo, no el esquema. Que falte una
  # micro de ejemplo no justifica dejar el API abajo.
  if [ "$SEED_DEMO_DATA" = "true" ]; then
    echo "Sembrando datos de demo..."
    if node dist/seed.js; then
      echo "Seed aplicado."
    else
      aviso \
        "Fallo el seed de datos de demo. El API arranca IGUAL, con la base tal" \
        "como estuviera antes. Esto es deliberado: el esquema esta bien y un" \
        "dato de demo que falta no justifica dejar el servicio caido." \
        "" \
        "Que queda roto, en concreto:" \
        " - si la base estaba vacia, GET /api/companies devuelve [] y" \
        "   GET /api/live/buses devuelve 0 micros, ambos con status 200;" \
        " - el mapa se ve vacio y es INDISTINGUIBLE de 'no hay micros en ruta';" \
        " - sin choferes sembrados, el servicio miqui-simulator no tiene con" \
        "   quien autenticarse y se queda sin levantar ninguna micro." \
        "" \
        "Como confirmarlo desde fuera, sin entrar a la tarea:" \
        "  curl -s \"\$(terraform -chdir=infra/terraform output -raw public_api_url)/api/companies\" | jq length" \
        "Si responde 0, la base quedo vacia." \
        "" \
        "Que hacer: leer el error de arriba y redesplegar con" \
        "  SEED_DEMO_DATA=true ./infra/scripts/deploy-api.sh"
    fi
  fi
fi

# Nota sobre el otro fallo silencioso de la cadena: ya con el API arriba,
# src/index.ts llama a hydrateLiveTrips() dentro de un try/catch que solo hace
# console.error. Si eso falla, el proceso sigue y las micros con turno abierto no
# se repueblan: el mapa arranca vacio hasta el siguiente ping de cada chofer, sin
# que /api/health lo note. Si el mapa sale vacio y el seed fue bien, buscar
# "No se pudo recuperar el estado en vivo" en este mismo log group.
exec "$@"
