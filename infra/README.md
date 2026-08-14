# Infraestructura AWS

> **Ya esta desplegada.** URLs, credenciales de demo, diagramas y como borrarla:
> [`../infra.md`](../infra.md).

Terraform que levanta el proyecto completo. CloudFront es la unica puerta de entrada y
reparte segun la ruta:

```
                       ┌── default ──> S3 (bundle de Vite)
Internet ──> CloudFront ┤
              (HTTPS)   └── /api/*  ──> ALB ──> ECS Fargate (Express) ──> RDS Postgres
                                                      ↑
                                                    ECR (imagen del API)
```

Que el API viva bajo el mismo dominio que el front no es un detalle: es lo que le da HTTPS
sin dominio propio ni certificado ACM (el navegador bloquearia una pagina HTTPS llamando a
un ALB por HTTP), y de paso deja las llamadas como mismo-origen, asi que **CORS no interviene
en produccion**.

| Recurso            | Para que sirve                                                        |
| ------------------ | --------------------------------------------------------------------- |
| VPC + 2 AZ         | Red propia, subredes publicas (ALB/ECS) y privadas (RDS)              |
| ECR                | Registro de la imagen Docker del API                                  |
| ECS Fargate + ALB  | Corre el API sin gestionar servidores, con health check `/api/health` |
| RDS Postgres 16    | Base de datos, no accesible desde internet                            |
| Secrets Manager    | `DATABASE_URL` y `JWT_SECRET`; ECS los inyecta en la tarea            |
| S3 + CloudFront    | Sirve el build de Vite por HTTPS y enruta `/api/*` al ALB             |
| CloudFront Function | Routing del SPA (ver mas abajo por que no se usan error responses)   |

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

# 2) Front -> S3 -> CloudFront (VITE_API_URL vacio: /api es mismo-origen)
../scripts/deploy-web.sh

# La URL para el equipo de frontend:
terraform output -raw public_api_url
```

Ambos scripts son repetibles y leen todo de `terraform output`: no hay ninguna URL ni ARN
escrito a mano. Cada vez que aterrice un cambio del backend, `deploy-api.sh` lo publica en
~2 minutos con un rolling deploy sin caida.

Las migraciones de Prisma y el seed se aplican solos en el arranque del contenedor
(`apps/api/docker-entrypoint.sh`): `prisma migrate deploy` y, si `seed_demo_data = true`,
`node dist/seed.js`. El seed es idempotente, asi que correrlo en cada despliegue no duplica
nada; para apagarlo antes de la presentacion, `-var="seed_demo_data=false"`.

**No hace falta un segundo apply para CORS.** El front llama a `/api` relativo a traves de
CloudFront, asi que en produccion es mismo-origen y CORS no participa. `cors_origin` existe
solo para levantar Vite en `localhost:5173` contra esta API, y ya viene con ese valor.

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

El bucket y el repositorio ECR tienen `force_destroy`/`force_delete`, RDS
`skip_final_snapshot` y los secretos `recovery_window_in_days = 0`, asi que `destroy` no
se queda a medias ni deja secretos en cuarentena.

Todos los recursos llevan el prefijo `hackathon-equipo17-demo` y los tags
`Hackathon=haCAIthon-2026`, `Team=equipo-17`, `Temporary=true` y `DeleteAfter`. Para
comprobar que no quedo nada corriendo:

```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Hackathon,Values=haCAIthon-2026 \
  --region us-east-1 --query 'ResourceTagMappingList[].ResourceARN'
```

## Notas

- El state es local. Si se pierde, el `destroy` hay que hacerlo a mano por consola. Para
  compartirlo, descomenta el backend S3 en `versions.tf`.
- El ALB va por HTTP, pero eso no llega al navegador: CloudFront termina el TLS y habla
  HTTP con el ALB dentro de AWS. Un dominio propio + certificado ACM solo hace falta si se
  quiere una URL bonita.
- **El SPA no usa `custom_error_response`, sino la CloudFront Function `spa-rewrite`.** Los
  error responses son de toda la distribucion: convertirian tambien los `403` de
  `requireRole` y los `404` de `notFound` en `index.html` con status `200`, y el frontend
  recibiria HTML donde espera JSON. La funcion solo esta asociada al behavior del S3.
- El servicio ECS ignora cambios en `task_definition` (`lifecycle.ignore_changes`) para no
  pelear con `deploy-api.sh`. Por eso el script resuelve explicitamente la ultima revision
  y se la pasa a `update-service`: si cambias CPU, memoria o variables de entorno en
  Terraform, corre `apply` y despues `deploy-api.sh` para que el servicio la tome.
