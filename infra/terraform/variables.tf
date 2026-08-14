variable "aws_region" {
  description = "Region de AWS donde se despliega todo."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefijo de todos los recursos."
  type        = string
  default     = "equipo17"
}

variable "environment" {
  description = "Entorno logico (dev, prod...)."
  type        = string
  default     = "dev"
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
  description = "Origen permitido por el API. Tras el primer apply, pon aqui la URL de CloudFront."
  type        = string
  default     = "*"
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
