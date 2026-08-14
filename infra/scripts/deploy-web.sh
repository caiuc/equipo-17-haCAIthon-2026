#!/usr/bin/env bash
# Construye el frontend, lo sube a S3 e invalida CloudFront.
# Uso: ./infra/scripts/deploy-web.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"
# El frontend vive en frontend/ (fuera de apps/ por razones historicas) y es un
# paquete mas del workspace de pnpm: @equipo17/web.
WEB_DIR="$REPO_ROOT/frontend"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1"; }

BUCKET="$(tf_out web_bucket)"
DISTRIBUTION_ID="$(tf_out cloudfront_distribution_id)"

# La clave de Google Maps se hornea en el bundle: sin ella el mapa muestra un
# placeholder. Restringela por dominio en la consola de Google, porque una clave
# de navegador es publica por definicion.
: "${VITE_GOOGLE_MAPS_API_KEY:=}"
: "${VITE_GOOGLE_MAPS_MAP_ID:=}"
for var in VITE_GOOGLE_MAPS_API_KEY VITE_GOOGLE_MAPS_MAP_ID; do
  if [ -z "${!var}" ] && [ -f "$WEB_DIR/.env" ]; then
    printf -v "$var" '%s' "$(grep -E "^${var}=" "$WEB_DIR/.env" | cut -d= -f2- || true)"
  fi
done
[ -z "$VITE_GOOGLE_MAPS_API_KEY" ] && echo "AVISO: sin VITE_GOOGLE_MAPS_API_KEY, el mapa saldra como placeholder."
# AdvancedMarker exige un mapId: sin el, las micros no pueden rotar segun su rumbo.
[ -z "$VITE_GOOGLE_MAPS_MAP_ID" ] && echo "AVISO: sin VITE_GOOGLE_MAPS_MAP_ID, las micros no rotaran."

# VITE_API_URL vacio a proposito: el mismo CloudFront enruta /api/* al ALB, asi que el
# front llama a rutas relativas igual que en desarrollo. Hornear aqui la URL del ALB
# (http://) romperia todos los fetch por mixed content, porque la pagina va por HTTPS.
echo "==> Build del front (VITE_API_URL vacio: /api es mismo-origen)"
cd "$REPO_ROOT"

pnpm install --frozen-lockfile

VITE_API_URL="" \
  VITE_GOOGLE_MAPS_API_KEY="$VITE_GOOGLE_MAPS_API_KEY" \
  VITE_GOOGLE_MAPS_MAP_ID="$VITE_GOOGLE_MAPS_MAP_ID" \
  pnpm --filter @equipo17/web build

echo "==> Sync a s3://$BUCKET"
# Assets con hash: cache larga. index.html: siempre fresco.
aws s3 sync "$WEB_DIR/dist" "s3://$BUCKET" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 cp "$WEB_DIR/dist/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache"

echo "==> Invalidando CloudFront ($DISTRIBUTION_ID)"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --no-cli-pager \
  --query 'Invalidation.{id:Id,status:Status}'

echo "==> Listo."
echo "    Web: $(tf_out web_url)"
echo "    API: $(tf_out public_api_url)"
