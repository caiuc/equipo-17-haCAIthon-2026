#!/usr/bin/env bash
# Construye el frontend apuntando al ALB, lo sube a S3 e invalida CloudFront.
# Uso: ./infra/scripts/deploy-web.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1"; }

BUCKET="$(tf_out web_bucket)"
DISTRIBUTION_ID="$(tf_out cloudfront_distribution_id)"
API_URL="$(tf_out api_url)"

echo "==> Build del front (VITE_API_URL=$API_URL)"
VITE_API_URL="$API_URL" pnpm --dir "$REPO_ROOT" --filter @equipo17/web build

echo "==> Sync a s3://$BUCKET"
# Assets con hash: cache larga. index.html: siempre fresco.
aws s3 sync "$REPO_ROOT/apps/web/dist" "s3://$BUCKET" \
  --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 cp "$REPO_ROOT/apps/web/dist/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache"

echo "==> Invalidando CloudFront ($DISTRIBUTION_ID)"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --no-cli-pager \
  --query 'Invalidation.{id:Id,status:Status}'

echo "==> Listo. Web: $(tf_out web_url)"
