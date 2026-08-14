#!/usr/bin/env bash
# Construye el frontend, lo sube a S3 e invalida CloudFront.
# Uso: ./infra/scripts/deploy-web.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"
# El frontend real vive en frontend/ y usa yarn, fuera del workspace de pnpm.
# apps/web es el scaffold original y no se despliega.
WEB_DIR="$REPO_ROOT/frontend"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1"; }

BUCKET="$(tf_out web_bucket)"
DISTRIBUTION_ID="$(tf_out cloudfront_distribution_id)"

# La clave de Google Maps se hornea en el bundle: sin ella el mapa muestra un
# placeholder. Restringela por dominio en la consola de Google, porque una clave
# de navegador es publica por definicion.
: "${VITE_GOOGLE_MAPS_API_KEY:=}"
if [ -z "$VITE_GOOGLE_MAPS_API_KEY" ] && [ -f "$WEB_DIR/.env" ]; then
  VITE_GOOGLE_MAPS_API_KEY="$(grep -E '^VITE_GOOGLE_MAPS_API_KEY=' "$WEB_DIR/.env" | cut -d= -f2- || true)"
fi
[ -z "$VITE_GOOGLE_MAPS_API_KEY" ] && echo "AVISO: sin VITE_GOOGLE_MAPS_API_KEY, el mapa saldra como placeholder."

# VITE_API_URL vacio a proposito: el mismo CloudFront enruta /api/* al ALB, asi que el
# front llama a rutas relativas igual que en desarrollo. Hornear aqui la URL del ALB
# (http://) romperia todos los fetch por mixed content, porque la pagina va por HTTPS.
echo "==> Build del front (VITE_API_URL vacio: /api es mismo-origen)"
cd "$WEB_DIR"

# El proyecto se creo con yarn, pero no todas las maquinas del equipo lo tienen.
# npm resuelve el mismo package.json, asi que sirve de reserva.
if command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile
  BUILD="yarn build"
else
  echo "    (yarn no esta instalado, se usa npm)"
  npm install --no-audit --no-fund
  BUILD="npm run build"
fi

VITE_API_URL="" VITE_GOOGLE_MAPS_API_KEY="$VITE_GOOGLE_MAPS_API_KEY" $BUILD

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
