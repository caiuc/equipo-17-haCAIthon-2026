# Infraestructura AWS

Terraform que levanta el proyecto completo:

```
Internet ──> CloudFront ──> S3 (frontend estatico)
        └──> ALB ──> ECS Fargate (API Express) ──> RDS Postgres
                          ↑
                        ECR (imagen del API)
```

| Recurso           | Para que sirve                                                        |
| ----------------- | --------------------------------------------------------------------- |
| VPC + 2 AZ        | Red propia, subredes publicas (ALB/ECS) y privadas (RDS)              |
| ECR               | Registro de la imagen Docker del API                                  |
| ECS Fargate + ALB | Corre el API sin gestionar servidores, con health check `/api/health` |
| RDS Postgres 16   | Base de datos, no accesible desde internet                            |
| Secrets Manager   | Guarda la `DATABASE_URL`; ECS la inyecta en la tarea                  |
| S3 + CloudFront   | Sirve el build de Vite por HTTPS con routing SPA                      |

## Requisitos

- Credenciales de AWS configuradas (`aws configure` o `AWS_PROFILE`).
- Terraform >= 1.6 y Docker.

## Despliegue

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars

terraform init
terraform plan            # revisa siempre antes de aplicar
terraform apply           # ~10-15 min, casi todo es RDS y CloudFront

# 1) Imagen del API -> ECR -> ECS
../scripts/deploy-api.sh

# 2) Front -> S3 -> CloudFront (usa el ALB como VITE_API_URL)
../scripts/deploy-web.sh
```

Las migraciones de Prisma se aplican solas: el contenedor corre `prisma migrate deploy`
en el arranque (`apps/api/docker-entrypoint.sh`).

Tras el primer `apply`, copia la URL de CloudFront a `cors_origin` en
`terraform.tfvars` y vuelve a aplicar para cerrar CORS:

```bash
terraform apply -var="cors_origin=$(terraform output -raw web_url)"
```

## Costos

Con los valores por defecto (`enable_nat_gateway = false`) lo que se paga de forma
continua es aproximadamente:

| Recurso                          | Aprox. USD/mes |
| -------------------------------- | -------------- |
| ALB                              | ~16            |
| ECS Fargate (0.25 vCPU, 1 tarea) | ~9             |
| RDS db.t4g.micro + 20 GB         | ~15            |
| S3 + CloudFront (trafico bajo)   | ~1             |
| **Total**                        | **~40**        |

Poner `enable_nat_gateway = true` agrega ~USD 32/mes. Por eso el default es `false`:
las tareas corren en subredes publicas con IP publica, pero su security group solo
acepta trafico del ALB, y RDS sigue en subredes privadas.

**Al terminar la hackathon, destruye todo:**

```bash
cd infra/terraform && terraform destroy
```

El bucket y el repositorio ECR tienen `force_destroy`/`force_delete`, y RDS
`skip_final_snapshot`, asi que `destroy` no se queda a medias.

## Notas

- El state es local. Para compartirlo, descomenta el backend S3 en `versions.tf`.
- El ALB va por HTTP. Para HTTPS hace falta un dominio y un certificado ACM
  (`aws_acm_certificate` + listener 443).
- El servicio ECS ignora cambios en `task_definition` (`lifecycle.ignore_changes`)
  porque `deploy-api.sh` redespliega con `force-new-deployment` sobre el mismo tag.
  Si cambias CPU, memoria o variables de entorno en Terraform, corre `apply` y luego
  `deploy-api.sh` para que el servicio tome la revision nueva.
