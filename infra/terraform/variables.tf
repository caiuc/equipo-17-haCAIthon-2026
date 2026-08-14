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
  description = "Numero de tareas del servicio ECS."
  type        = number
  default     = 1
}

variable "cors_origin" {
  description = <<-EOT
    Origenes permitidos por el API, separados por coma. En produccion el front llama a
    /api relativo a traves de CloudFront, asi que es mismo-origen y CORS no interviene:
    esto existe para que el equipo pueda levantar Vite en localhost contra esta API.
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
