output "aws_region" {
  description = "Region donde vive el stack (la usan los scripts de deploy)."
  value       = var.aws_region
}

output "ecr_repository_url" {
  description = "Repositorio donde se sube la imagen del API."
  value       = aws_ecr_repository.api.repository_url
}

output "public_api_url" {
  description = <<-EOT
    LA URL DEL API. Es la que se le pasa al equipo de frontend y la que responde por HTTPS.
    El front no necesita configurarla: al servirse desde el mismo CloudFront, llama a /api
    relativo igual que en desarrollo con el proxy de Vite.
  EOT
  value       = "https://${aws_cloudfront_distribution.web.domain_name}/api"
}

output "api_url" {
  description = <<-EOT
    ALB directo, solo HTTP. Sirve para curl y para mirar logs sin pasar por CloudFront.
    NO usar desde el navegador: la pagina va por HTTPS y el navegador bloquea la mezcla.
  EOT
  value       = "http://${aws_lb.api.dns_name}"
}

output "web_url" {
  description = "URL publica del frontend."
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "web_bucket" {
  description = "Bucket S3 del frontend."
  value       = aws_s3_bucket.web.bucket
}

output "cloudfront_distribution_id" {
  description = "ID de la distribucion, necesario para invalidar cache."
  value       = aws_cloudfront_distribution.web.id
}

output "ecs_cluster" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service" {
  description = "Nombre del servicio ECS del API."
  value       = aws_ecs_service.api.name
}

output "ecs_simulator_service" {
  description = <<-EOT
    Nombre del servicio ECS del simulador. Arranca apagado (desired_count 0); se
    enciende a mano antes de la demo:
      aws ecs update-service --cluster <ecs_cluster> --service <este> --desired-count 1
  EOT
  value       = aws_ecs_service.simulator.name
}

output "db_endpoint" {
  description = "Endpoint de RDS (solo accesible desde la VPC)."
  value       = aws_db_instance.main.address
}

output "database_url_secret_arn" {
  description = "ARN del secreto con la DATABASE_URL completa."
  value       = aws_secretsmanager_secret.database_url.arn
}
