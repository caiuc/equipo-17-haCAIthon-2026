#!/usr/bin/env bash
# Construye la imagen del API, la sube a ECR y fuerza un nuevo despliegue en ECS.
# Uso: ./infra/scripts/deploy-api.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1"; }

ECR_URL="$(tf_out ecr_repository_url)"
CLUSTER="$(tf_out ecs_cluster)"
SERVICE="$(tf_out ecs_service)"
REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || echo "${AWS_REGION:-us-east-1}")"
REGISTRY="${ECR_URL%%/*}"
TAG="${1:-latest}"

echo "==> Login en ECR ($REGISTRY)"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> Build de la imagen ($ECR_URL:$TAG)"
docker build \
  --platform linux/amd64 \
  -f "$REPO_ROOT/apps/api/Dockerfile" \
  -t "$ECR_URL:$TAG" \
  "$REPO_ROOT"

echo "==> Push"
docker push "$ECR_URL:$TAG"

echo "==> Redesplegando el servicio ECS ($CLUSTER/$SERVICE)"
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region "$REGION" \
  --no-cli-pager \
  --query 'service.deployments[0].{status:status,desired:desiredCount}'

echo "==> Listo. API: $(tf_out api_url)"
echo "    Logs: aws logs tail /ecs/\$(basename $SERVICE) --follow"
