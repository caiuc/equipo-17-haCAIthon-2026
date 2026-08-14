# Infraestructura desplegada — haCAIthon 2026, equipo 17

Stack **vivo** en AWS. Guía de operación y referencia visual; los detalles de cada recurso
están en [`infra/README.md`](infra/README.md) y el código en [`infra/terraform/`](infra/terraform/).

|         |                                                                                          |
| ------- | ---------------------------------------------------------------------------------------- |
| **Web** | https://d6bg0tya67l5a.cloudfront.net                                                     |
| **API** | https://d6bg0tya67l5a.cloudfront.net/api                                                 |
| Cuenta  | `admin_lebesgue` — 475345973285                                                          |
| Región  | `us-east-1`                                                                              |
| Prefijo | `hackathon-equipo17-demo`                                                                |
| Estado  | ALB target `healthy`, migraciones aplicadas, seed cargado (17 recorridos, 118 paraderos) |

> El frontend **no configura nada**: se sirve desde el mismo CloudFront que enruta `/api/*`,
> así que llama a rutas relativas (`fetch('/api/routes')`) igual que en desarrollo con el proxy
> de Vite. `VITE_API_URL` queda vacío en los dos entornos.

---

## Arquitectura

```mermaid
graph LR
    subgraph internet[" "]
        U["🌐 Navegador"]
    end

    CF["<b>CloudFront</b><br/>E2EVCVIDOM3EB9<br/>d6bg0tya67l5a.cloudfront.net"]

    subgraph aws["AWS · us-east-1 · VPC 10.20.0.0/16"]
        direction TB
        S3["<b>S3</b> (privado, OAC)<br/>hackathon-equipo17-demo-web-…<br/><i>bundle de Vite</i>"]
        ALB["<b>ALB</b> :80<br/>hackathon-equipo17-demo-api<br/><i>subredes públicas</i>"]
        ECS["<b>ECS Fargate</b> :3000<br/>0.25 vCPU · 512 MiB · 1 tarea<br/><i>Express 5 + Prisma</i>"]
        RDS[("<b>RDS Postgres 16</b><br/>db.t4g.micro<br/><i>subredes privadas</i>")]
        SM["<b>Secrets Manager</b><br/>DATABASE_URL · JWT_SECRET"]
        ECR["<b>ECR</b><br/>imagen del API"]
    end

    U -->|HTTPS| CF
    CF -->|"default →"| S3
    CF -->|"/api/* → HTTP"| ALB
    ALB --> ECS
    ECS -->|":5432 privado"| RDS
    SM -.->|"inyectado al arrancar"| ECS
    ECR -.->|"docker pull"| ECS

    classDef edge fill:#1e3a5f,stroke:#4a90d9,color:#fff
    classDef store fill:#3d2f1f,stroke:#c9a227,color:#fff
    class CF,ALB edge
    class RDS,SM,ECR,S3 store
```

**Las dos decisiones que hacen que esto funcione:**

1. **`/api/*` pasa por CloudFront.** El navegador habla TLS con CloudFront y CloudFront habla
   HTTP con el ALB dentro de AWS. Sin esto haría falta un dominio y un certificado ACM, o el
   navegador bloquearía todos los `fetch` por _mixed content_ (página HTTPS → API HTTP).
   Efecto secundario: front y API quedan en el **mismo origen**, así que CORS desaparece.
2. **El fallback del SPA es una CloudFront Function, no `custom_error_response`.** Los errores
   personalizados son de **toda la distribución**: convertirían también los `403` de
   `requireRole` y los `404` de `notFound` en `index.html` con status `200`, y el frontend
   recibiría HTML donde espera JSON. La función solo está asociada al comportamiento del S3.

## Cómo se resuelve cada petición

```mermaid
flowchart TD
    R["Petición a CloudFront"] --> M{"¿URI empieza<br/>con /api/ ?"}

    M -->|Sí| API["Behavior <b>/api/*</b><br/>origen: ALB"]
    API --> P1["CachePolicy: <b>CachingDisabled</b><br/><i>la posición de una micro<br/>no se cachea jamás</i>"]
    P1 --> P2["OriginRequestPolicy:<br/><b>AllViewerExceptHostHeader</b><br/><i>reenvía el Bearer token</i>"]
    P2 --> P3["Métodos: GET HEAD OPTIONS<br/>PUT POST PATCH DELETE"]
    P3 --> RESP["Respuesta del API<br/><i>200 / 401 / 404 intactos</i>"]

    M -->|No| WEB["Behavior <b>default</b><br/>origen: S3 vía OAC"]
    WEB --> F{"CloudFront Function<br/>¿la URI tiene punto?"}
    F -->|"Sí · /assets/app.js"| A["Archivo del bundle<br/>cache 1 año inmutable"]
    F -->|"No · /mapa/ruta-3"| I["Reescribe a /index.html<br/>el router del SPA se encarga"]

    classDef api fill:#1e3a5f,stroke:#4a90d9,color:#fff
    classDef web fill:#2d1f3d,stroke:#9d6bd9,color:#fff
    class API,P1,P2,P3,RESP api
    class WEB,F,A,I web
```

## Red

```mermaid
graph TB
    subgraph vpc["VPC 10.20.0.0/16 · 2 AZ"]
        subgraph pub["Subredes públicas · 10.20.0.0/24 · 10.20.1.0/24"]
            IGW["Internet Gateway"]
            ALBN["ALB"]
            TASK["Tarea Fargate<br/><i>con IP pública</i>"]
        end
        subgraph priv["Subredes privadas · 10.20.10.0/24 · 10.20.11.0/24"]
            DB[("RDS Postgres")]
        end
    end

    IGW --- ALBN
    ALBN -->|"sg-alb → sg-api<br/>:3000"| TASK
    TASK -->|"sg-api → sg-db<br/>:5432"| DB
    TASK -.->|"salida: pull de ECR"| IGW

    classDef sg fill:#2d3a1f,stroke:#8bc34a,color:#fff
    class ALBN,TASK,DB sg
```

Las tareas corren en subredes **públicas** con IP pública porque sin NAT Gateway es la única
forma de que bajen la imagen de ECR — pero su security group solo acepta tráfico del ALB, así
que no son alcanzables desde internet. Eso ahorra los ~USD 32/mes del NAT. Para cerrarlo del
todo: `enable_nat_gateway = true` en `terraform.tfvars`.

RDS nunca sale de las subredes privadas y solo acepta conexiones desde el security group de la
tarea. Para conectarse desde un portátil hay que pasar por un bastión o ECS Exec.

## Arranque del contenedor

```mermaid
sequenceDiagram
    participant ECS as ECS Fargate
    participant SM as Secrets Manager
    participant C as docker-entrypoint.sh
    participant DB as RDS
    participant ALB

    ECS->>SM: GetSecretValue (rol de ejecución)
    SM-->>ECS: DATABASE_URL + JWT_SECRET
    Note over ECS: nunca en texto plano<br/>en la task definition
    ECS->>C: arranca con el entorno inyectado
    C->>DB: prisma migrate deploy
    DB-->>C: sin migraciones pendientes
    C->>DB: node dist/seed.js (si SEED_DEMO_DATA=true)
    Note over C,DB: idempotente: upsert por email<br/>y por (companyId, code)
    C->>C: node dist/index.js
    C->>DB: hydrateLiveTrips() — recupera turnos IN_TRANSIT
    loop cada 30 s
        ALB->>C: GET /api/health
        C->>DB: SELECT 1
        C-->>ALB: 200 {status:"ok"}
    end
```

El API **se niega a arrancar** en producción si `JWT_SECRET` sigue siendo el de desarrollo
(`apps/api/src/config/env.ts`). Por eso Terraform genera uno con `random_password` de 48
caracteres y lo guarda en Secrets Manager: nadie tiene que inventarlo ni pegarlo en ningún lado.

## Ciclo de despliegue

```mermaid
flowchart LR
    subgraph api["./infra/scripts/deploy-api.sh · ~2 min"]
        direction TB
        A1["docker build<br/>--platform linux/amd64"] --> A2["push a ECR"] --> A3["update-service<br/>--force-new-deployment"] --> A4["rolling deploy<br/>sin caída"]
    end
    subgraph web["./infra/scripts/deploy-web.sh · ~1 min"]
        direction TB
        W1["vite build<br/>VITE_API_URL vacío"] --> W2["s3 sync<br/>assets inmutables<br/>index.html no-cache"] --> W3["invalidación /*"]
    end
```

Los dos scripts leen todo de `terraform output`, así que no hay ninguna URL ni ARN escrito a
mano. Se pueden correr las veces que haga falta, en cualquier orden.

---

## Uso diario

```bash
# Publicar cambios del backend (cada vez que aterrice un controller)
./infra/scripts/deploy-api.sh

# Publicar cambios del frontend
./infra/scripts/deploy-web.sh

# Ver qué está pasando en la API
aws logs tail /ecs/hackathon-equipo17-demo-api --follow --region us-east-1
```

### Desarrollo local contra la API desplegada

En `apps/web/.env`, sin tocar nada más:

```bash
VITE_DEV_API_TARGET=https://d6bg0tya67l5a.cloudfront.net
```

`pnpm dev` y listo. El proxy de Vite es server-side, así que no hay CORS de por medio. Si en
cambio se llama directo con `fetch` desde el navegador, `CORS_ORIGIN` ya permite
`http://localhost:5173`.

### Credenciales de demo

Todas con clave **`demo1234`**:

| Email                                         | Rol                                     |
| --------------------------------------------- | --------------------------------------- |
| `superadmin@demo.cl`                          | SUPERADMIN                              |
| `admin@bupesa.cl`                             | COMPANY_ADMIN — Buses Peñaflor (Bupesa) |
| `chofer1@bupesa.cl` · `chofer2@` · `chofer3@` | DRIVER                                  |
| `pasajero@demo.cl`                            | PASSENGER                               |

```bash
curl -s -X POST https://d6bg0tya67l5a.cloudfront.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@bupesa.cl","password":"demo1234"}'
```

### Micros moviéndose de verdad

El simulador habla HTTP igual que el teléfono de un chofer, así que funciona contra la infra
desplegada. Útil para desarrollar el mapa sin que nadie tenga que manejar:

```bash
API_URL=https://d6bg0tya67l5a.cloudfront.net pnpm --filter @equipo17/api simulate

# Para mostrar la degradación En vivo → Señal intermitente → Sin señal:
API_URL=https://d6bg0tya67l5a.cloudfront.net pnpm --filter @equipo17/api simulate -- --drop-signal
```

---

## Recursos creados

Todos con el prefijo `hackathon-equipo17-demo` y los tags `Hackathon=haCAIthon-2026`,
`Team=equipo-17`, `Temporary=true`, `DeleteAfter=2026-08-31`, `ManagedBy=terraform`.

| Recurso                                 | Nombre                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| VPC / cluster ECS                       | `hackathon-equipo17-demo`                              |
| ALB / target group / servicio ECS / ECR | `hackathon-equipo17-demo-api`                          |
| RDS Postgres 16                         | `hackathon-equipo17-demo-db`                           |
| Bucket del frontend                     | `hackathon-equipo17-demo-web-475345973285`             |
| Distribución CloudFront                 | `E2EVCVIDOM3EB9`                                       |
| CloudFront Function                     | `hackathon-equipo17-demo-spa-rewrite`                  |
| Log group                               | `/ecs/hackathon-equipo17-demo-api` (retención 7 días)  |
| Secretos                                | `hackathon-equipo17-demo/database-url` · `/jwt-secret` |

**Costo:** ~USD 1,3/día — ALB ~16/mes, Fargate ~9, RDS ~15, S3+CloudFront ~1.

## Borrar todo al terminar

```bash
cd infra/terraform && terraform destroy
```

El bucket tiene `force_destroy`, ECR `force_delete`, RDS `skip_final_snapshot` y los secretos
`recovery_window_in_days = 0`, así que `destroy` no se queda a medias ni deja secretos en
cuarentena. Después, verificar que no quedó nada:

```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Hackathon,Values=haCAIthon-2026 \
  --region us-east-1 --query 'ResourceTagMappingList[].ResourceARN'
```

Debe devolver una lista vacía. El state de Terraform es **local** (`infra/terraform/`): si se
pierde ese archivo, el `destroy` hay que hacerlo a mano por consola.
