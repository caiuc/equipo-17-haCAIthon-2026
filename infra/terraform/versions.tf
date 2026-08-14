terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # El state vive en local por defecto (suficiente para la hackathon).
  # Para trabajar en equipo, crea el bucket y descomenta:
  #
  # backend "s3" {
  #   bucket       = "equipo17-tfstate"
  #   key          = "hacaithon/terraform.tfstate"
  #   region       = "us-east-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}
