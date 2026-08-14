provider "aws" {
  region = var.aws_region

  # Estos tags viajan a todos los recursos. Hackathon/Temporary/DeleteAfter estan para
  # que al terminar el evento se pueda auditar por tag que no quedo nada corriendo.
  default_tags {
    tags = {
      Project     = var.project_name
      Env         = var.environment
      ManagedBy   = "terraform"
      Hackathon   = "haCAIthon-2026"
      Team        = "equipo-17"
      Temporary   = "true"
      DeleteAfter = var.delete_after
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project_name}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}
