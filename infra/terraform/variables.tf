variable "aws_region" {
  description = "Region de AWS donde se despliega todo."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = <<-EOT
    Prefijo de todos los recursos. Lleva "hackathon" a proposito: quien mire la consola
    de AWS tiene que darse cuenta al instante de que esto es desechable.
  EOT
  type        = string
  default     = "hackathon-equipo17"
}

variable "environment" {
  description = "Entorno logico. Junto a project_name forma el prefijo de cada recurso."
  type        = string
  default     = "demo"
}

variable "delete_after" {
  description = <<-EOT
    Fecha a partir de la cual esta infra se puede borrar sin preguntar. Va como tag
    DeleteAfter en todos los recursos, para poder auditar con:
      aws resourcegroupstaggingapi get-resources --tag-filters Key=Hackathon,Values=haCAIthon-2026
  EOT
  type        = string
  default     = "2026-08-31"
}

variable "vpc_cidr" {
  description = "CIDR de la VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "enable_nat_gateway" {
  description = <<-EOT
    Si es true, las tareas de ECS corren en subredes privadas detras de un NAT Gateway
    (mas seguro, ~USD 32/mes adicionales). Si es false, corren en subredes publicas con
    IP publica y solo aceptan trafico desde el ALB. Para una hackathon, false.
  EOT
  type        = bool
  default     = false
}

# --- API / ECS ---

variable "api_image_tag" {
  description = "Tag de la imagen del API en ECR."
  type        = string
  default     = "latest"
}

variable "api_cpu" {
  description = "Unidades de CPU de la tarea Fargate (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "api_memory" {
  description = "Memoria en MiB de la tarea Fargate."
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = <<-EOT
    Numero de tareas del servicio ECS del API.

    RESTRICCION DURA: tiene que ser 1. No es un default conservador, es un limite
    de la arquitectura actual.

    La ultima posicion de cada micro vive en un Map en memoria del proceso
    (apps/api/src/services/liveStore.ts). Con 2 tareas detras del ALB, el chofer
    hace POST de su posicion a la tarea A y el pasajero consulta el mapa en la
    tarea B: la micro simplemente no esta ahi. No hay error, no hay 500, no hay
    log: medio mapa desaparece y parece que esas micros no estan transmitiendo,
    que es exactamente la mentira que este proyecto existe para no contar.

    Las sticky sessions NO lo arreglan: pegan a cada CLIENTE con una tarea, pero
    aca el escritor (el telefono del chofer) y el lector (el telefono del
    pasajero) son clientes distintos y terminarian pegados a tareas distintas.
    Peor: el fallo se reparte al azar, asi que en una prueba corta parece
    funcionar.

    Para subir de 1 hay que mover el store fuera del proceso primero -- Redis
    (ElastiCache) o DynamoDB con TTL -- y recien ahi tocar esta variable.

    Ojo con el incentivo: el mapa multiempresa hace que el fallo se vea MAS
    (mas micros repartidas entre tareas), y la reaccion natural frente a un mapa
    con menos micros de las esperadas es "subamos a 2 tareas", que lo empeora.
  EOT
  type        = number
  default     = 1

  validation {
    # El comentario de arriba se puede ignorar de un scroll; esto no. Se permite 0
    # (apagar el servicio para no gastar) pero nunca 2 o mas.
    condition     = var.api_desired_count <= 1
    error_message = "api_desired_count no puede pasar de 1: el store de posiciones vive en memoria del proceso y con 2 tareas el mapa pierde micros en silencio. Mover el store a Redis antes de escalar. Ver el comentario de la variable en variables.tf."
  }
}

variable "cors_origin" {
  description = <<-EOT
    Origenes permitidos por el API, separados por coma.

    VERIFICADO en el despliegue vivo: en el camino de produccion CORS no
    interviene. La pagina y el API salen del MISMO origen de CloudFront (que
    enruta /api/* al ALB como segundo origen) y el front pide rutas relativas
    porque deploy-web.sh hornea VITE_API_URL vacio, asi que el navegador no manda
    cabecera Origin ni pide preflight.

    Este valor existe entonces para el unico camino que si es cross-origin: Vite
    en localhost apuntando contra la API desplegada. No hace falta agregarle el
    dominio de CloudFront.
  EOT
  type        = string
  default     = "http://localhost:5173"
}

variable "seed_demo_data" {
  description = <<-EOT
    Si es true, el contenedor corre apps/api/prisma/seed.ts al arrancar. El seed es
    idempotente (upsert), asi que puede correr en cada despliegue sin duplicar nada.
  EOT
  type        = bool
  default     = true
}

# --- Simulador (servicio ECS aparte, ver simulator.tf) ---

variable "simulator_desired_count" {
  description = <<-EOT
    Tareas del servicio miqui-simulator. 0 por defecto A PROPOSITO: el simulador
    corriendo sin que nadie mire es plata quemada y ruido en la base (turnos y
    posiciones falsas acumulandose). Se enciende a mano justo antes de la demo:

      aws ecs update-service --cluster "$(terraform output -raw ecs_cluster)" \
        --service "$(terraform output -raw ecs_simulator_service)" --desired-count 1

    y se apaga con --desired-count 0 al terminar.

    No tiene sentido pasar de 1: cada tarea hace su propio descubrimiento y sus
    propios logins con los MISMOS choferes de demo, asi que dos tareas se pisan
    los turnos entre si (ver el aviso de rate limit en simulator.tf).
  EOT
  type        = number
  default     = 0

  validation {
    condition     = var.simulator_desired_count >= 0 && var.simulator_desired_count <= 1
    error_message = "simulator_desired_count solo admite 0 o 1: varias tareas se pisan los turnos de los mismos choferes de demo."
  }
}

variable "simulator_buses" {
  description = <<-EOT
    Cuantas micros levanta el simulador (variable de entorno BUSES). Vacio deja el
    default del propio simulador: una por empresa, minimo 3.

    Cada micro cuesta un login al arrancar, y ese es el numero que hay que mirar
    frente al rate limit de /api/auth (ver simulator.tf).
  EOT
  type        = string
  default     = ""
}

variable "simulator_password" {
  description = <<-EOT
    Clave de los choferes de demo que usa el simulador (SIM_PASSWORD). Es la misma
    del seed y no es un secreto real: son cuentas de demostracion sembradas en una
    base desechable. Si el seed cambia la clave, cambiar esta tambien.
  EOT
  type        = string
  default     = "demo1234"
}

# --- Base de datos ---

variable "db_name" {
  description = "Nombre de la base de datos."
  type        = string
  default     = "equipo17"
}

variable "db_username" {
  description = "Usuario maestro de RDS."
  type        = string
  default     = "equipo17"
}

variable "db_instance_class" {
  description = "Clase de instancia de RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Almacenamiento en GB."
  type        = number
  default     = 20
}
