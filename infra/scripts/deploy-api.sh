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

# SEED_DEMO_DATA no viaja en este script: quien decide si el contenedor siembra es la
# variable de entorno de la TASK DEFINITION, que pone Terraform (var.seed_demo_data).
# Se comprueba aqui porque `SEED_DEMO_DATA=true ./deploy-api.sh` es lo que dice el
# README y seria una mentira silenciosa si el despliegue arrancara sin sembrar.
if [ "${SEED_DEMO_DATA:-}" = "true" ]; then
  TASK_DEF="$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
    --region "$REGION" --query 'services[0].taskDefinition' --output text 2>/dev/null || echo "")"
  SEED_EN_TAREA=""
  if [ -n "$TASK_DEF" ] && [ "$TASK_DEF" != "None" ]; then
    SEED_EN_TAREA="$(aws ecs describe-task-definition --task-definition "$TASK_DEF" \
      --region "$REGION" \
      --query "taskDefinition.containerDefinitions[0].environment[?name=='SEED_DEMO_DATA'].value | [0]" \
      --output text 2>/dev/null || echo "")"
  fi

  if [ "$SEED_EN_TAREA" = "true" ]; then
    echo "==> SEED_DEMO_DATA=true confirmado en la task definition"
  else
    # Aviso, no `exit 1`: si el describe falla por permisos o por red, bloquear el
    # despliegue seria peor que el problema que se intenta evitar.
    echo "AVISO: pediste SEED_DEMO_DATA=true, pero la task definition dice"
    echo "       SEED_DEMO_DATA=${SEED_EN_TAREA:-<no se pudo leer>}. Si es 'false', el contenedor"
    echo "       NO siembra y el mapa saldra vacio respondiendo 200 en todo. Se corrige con:"
    echo "         terraform -chdir=infra/terraform apply -var=\"seed_demo_data=true\""
    echo "       Verificalo despues con: curl -s \"\$(terraform -chdir=infra/terraform output -raw public_api_url)/api/companies\" | jq length"
  fi
fi

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
