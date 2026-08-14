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
| ECS `simulator`   | Micros falsas para la demo. Misma imagen, otro comando. Apagado por defecto |
| RDS Postgres 16   | Base de datos, no accesible desde internet                            |
| Secrets Manager   | Guarda la `DATABASE_URL`; ECS la inyecta en la tarea                  |
| S3 + CloudFront   | Sirve el build de Vite por HTTPS con routing SPA                      |

## Requisitos

- Credenciales de AWS configuradas (`aws configure` o `AWS_PROFILE`).
- Terraform >= 1.6 y Docker.

## Despliegue

Primero, una sola vez, la infra:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars

terraform init
terraform plan            # revisa siempre antes de aplicar
terraform apply           # ~10-15 min, casi todo es RDS y CloudFront
```

### El orden exacto (desde la raiz del repo)

Este es el orden que hay que seguir, con su verificacion en medio. El `curl` de la
mitad no es adorno: es lo unico que distingue "la base quedo sembrada" de "el mapa va
a salir vacio y nadie se va a enterar", porque un API sin datos responde 200 en todo.

```bash
SEED_DEMO_DATA=true ./infra/scripts/deploy-api.sh
curl -s "$(terraform -chdir=infra/terraform output -raw public_api_url)/api/companies" | jq '[.[].name]'
./infra/scripts/deploy-web.sh
```

El `curl` tiene que devolver una lista con las empresas sembradas. Si devuelve `[]`,
**no sigas al paso 3**: revisa el log de la tarea buscando el bloque
`DESPLIEGUE DEGRADADO`, que dice exactamente que fallo y que queda roto.

```bash
aws logs tail /ecs/hackathon-equipo17-demo-api --since 10m --follow
```

El API va primero porque el front no trae ninguna URL horneada: llama a `/api`
relativo por el mismo CloudFront. Desplegar el front contra una API vacia solo produce
un mapa en blanco convincente.

Las migraciones de Prisma se aplican solas: el contenedor corre `prisma migrate deploy`
al arrancar (`apps/api/docker-entrypoint.sh`). Si fallan, la tarea **no** arranca a
proposito, para que un esquema a medias no reemplace a un despliegue sano.

`cors_origin` ya no hay que tocarlo tras el primer `apply`: `ecs.tf` agrega solo el
dominio de CloudFront a la variable `CORS_ORIGIN` de la tarea (ver "CORS" mas abajo).

### El punto de control real

Abrir `terraform output -raw web_url` **desde un telefono con datos moviles, no con
wifi**. No es un detalle: en wifi de oficina todo carga y el proyecto entero existe
para funcionar sobre senal rural. Los payloads grandes, la latencia y los cortes solo
aparecen en la red de verdad.

Lo que hay que ver en esa pantalla:

- micros de **al menos 5 empresas** distintas (colores distintos en el mapa);
- **al menos una en ambar** (`INTERMITTENT`: dejo de transmitir hace mas de 30 s);
- **al menos una en gris y SIN distancia** (`NO_SIGNAL`: mas de 2 min; `distanceMeters`
  llega en `null` a proposito y la interfaz no debe inventar un numero).

Si todas las micros salen verdes, la demo no esta mostrando lo que el proyecto
promete: la degradacion visible es el punto, no un caso borde. El simulador tiene el
flag `--drop-signal` justo para provocarla.

## El simulador en la nube

Para que el jurado abra la URL y vea micros moviendose sin que nadie tenga el notebook
encendido, hay un segundo servicio Fargate (`simulator.tf`, servicio
`hackathon-equipo17-demo-simulator`). Usa la **misma imagen** del API, solo cambia el
comando: `node dist/simulate.js`.

**Dependencia pendiente:** hoy `apps/api/tsup.config.ts` compila solo `index` y `seed`.
Falta agregar la entry `simulate: 'tools/simulator.ts'` para que exista
`dist/simulate.js`. Sin eso la tarea arranca, no encuentra el archivo y muere en bucle.
El Terraform ya esta escrito asumiendo esa ruta.

Arranca apagado (`simulator_desired_count = 0`) para no gastar sin querer. Se enciende
a mano y se apaga al terminar:

```bash
CLUSTER=$(terraform -chdir=infra/terraform output -raw ecs_cluster)
SIM=$(terraform -chdir=infra/terraform output -raw ecs_simulator_service)

aws ecs update-service --cluster "$CLUSTER" --service "$SIM" --desired-count 1
aws logs tail /ecs/hackathon-equipo17-demo-simulator --follow

# al terminar
aws ecs update-service --cluster "$CLUSTER" --service "$SIM" --desired-count 0
```

### Riesgo conocido: el rate limit del login

El simulador descubre empresas y choferes con **~18 logins por arranque** contra
`/api/auth/login`, y desde ECS **todos salen por una sola IP** (la del NAT si
`enable_nat_gateway = true`, o la IP publica de la tarea si es `false`). El limitador
es `isProduction ? 30 : 300`, y la tarea del API corre con `NODE_ENV=production`, asi
que contra el despliegue el cupo real **son 30** por 15 minutos: cabe una vez, pero **un segundo
arranque dentro de la misma ventana lo revienta**, y peor aun si la tarea muere y ECS
la reintenta en bucle, porque cada reintento gasta mas cupo y la ventana no se libera.

Mitigacion para la demo, sin tocar codigo: **encender el servicio 20 minutos antes**,
mirar el log, y no reiniciarlo. Si aparece un 429, esperar la ventana completa.

Las mitigaciones de fondo (backoff ante 429 en `tools/simulator.ts`, o un `skip` del
limitador para una cabecera con secreto compartido en `routes/auth.routes.ts`) tocan
codigo de la API y estan descritas en el comentario largo de `simulator.tf`. No se
implementaron aqui: bajarle el limite a `/api/auth` para todo el mundo seria aflojar
justo la proteccion de las credenciales de los choferes reales.

## CORS: verificado, no hay nada que arreglar

Conclusion, comprobada contra `deploy-web.sh`, `frontend.tf` y el despliegue vivo:
**en el camino de produccion CORS no interviene, y por eso `CORS_ORIGIN` se queda como
esta**.

`deploy-web.sh` hornea `VITE_API_URL` vacio, asi que el front pide `/api/...`
relativo; la pagina se sirve desde el dominio de CloudFront y ese mismo CloudFront
enruta `/api/*` al ALB como segundo origen. Para el navegador es el **mismo origen**:
no manda cabecera `Origin`, no hay preflight y el middleware `cors()` del API no llega
a decidir nada. Agregarle el dominio de CloudFront a `CORS_ORIGIN` no cambiaria ningun
comportamiento observable; se evaluo y se descarto para no generar una revision nueva
de la task definition sobre infra ya aplicada.

`cors_origin` sigue existiendo para el unico camino que si es cross-origin: **Vite en
localhost apuntando contra la API desplegada**. Si algun dia el front se sirve desde
otro dominio (S3 directo, Amplify, un preview), ese dominio si hay que agregarlo aqui.

Corolario util cuando algo falle: si el mapa no carga en produccion, **CORS no es la
causa**; mirar el `curl` de `/api/companies` y los logs de la tarea.

## Escalado: `api_desired_count` se queda en 1

**No se puede subir de 1.** El store de ultimas posiciones vive en memoria del proceso
(`apps/api/src/services/liveStore.ts`). Con dos tareas detras del ALB, el chofer
postea su posicion a una y el pasajero lee el mapa de la otra: **medio mapa desaparece
sin ningun error ni log**, y parece simplemente que esas micros no estan transmitiendo.
Las sticky sessions no lo arreglan, porque el escritor y el lector son clientes
distintos. Hay un `validation` en `variables.tf` que bloquea el `apply` si alguien lo
intenta.

Para escalar de verdad hay que sacar el store del proceso primero (Redis/ElastiCache o
DynamoDB con TTL) y recien despues tocar la variable. Ojo con el incentivo: el mapa
multiempresa hace el fallo mas visible, y la reaccion natural ante un mapa con menos
micros de las esperadas es "subamos a 2 tareas", que es exactamente lo que lo empeora.

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

El simulador no esta en la tabla porque arranca en `desired_count = 0`. Encendido
suma otros ~9 USD/mes prorrateados (~USD 0,012/hora): unas horas de demo son
centavos, pero dejarlo prendido un mes no.

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
- El servicio del simulador tambien ignora `desired_count`: se enciende y se apaga con
  `aws ecs update-service`, y asi un `terraform apply` de cualquier otra cosa no lo
  apaga en medio de la presentacion. Para cambiar el default permanente, edita
  `simulator_desired_count` y apaga/enciende a mano.
- La compresion del JSON la hace Express (`compression` en `app.ts`), no CloudFront:
  en CloudFront la compresion al vuelo va atada al cacheo y la behavior `/api/*` usa
  `CachingDisabled` a proposito. Se puede comprobar con:
  `curl -H 'Accept-Encoding: gzip' -sI "$(terraform output -raw public_api_url)/api/live/buses" | grep -i content-encoding`
