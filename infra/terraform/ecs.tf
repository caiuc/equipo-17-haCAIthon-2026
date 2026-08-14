resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "disabled" # ahorra costo de CloudWatch
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}-api"
  retention_in_days = 7
}

# --- Roles ---

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Permiso extra para resolver el secreto de la DATABASE_URL al lanzar la tarea.
data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database_url.arn, aws_secretsmanager_secret.jwt.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${local.name}-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# Rol de la aplicacion: sin permisos por ahora. Agrega politicas aqui si el
# proyecto necesita S3, Bedrock, SES, etc.
resource "aws_iam_role" "task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# --- Load balancer ---

resource "aws_lb" "api" {
  name               = "${local.name}-api"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 15
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# --- Tarea y servicio ---

# CORS: VERIFICADO contra el despliegue vivo, y la conclusion es que aqui no hay nada
# que arreglar. deploy-web.sh hornea VITE_API_URL vacio, asi que el front pide
# "/api/..." relativo; la pagina se sirve desde el dominio de CloudFront y ese MISMO
# CloudFront enruta /api/* al ALB como segundo origen (ver frontend.tf). Para el
# navegador es el mismo origen: no manda cabecera Origin, no hay preflight, y el
# middleware cors() del API no llega a decidir nada. Si la demo falla, CORS no es la
# causa y agregar origenes aqui no cambiaria nada.
#
# Por eso CORS_ORIGIN se deja tal cual, con var.cors_origin: su unico consumidor real
# es el camino de desarrollo (Vite en localhost apuntando a esta API desplegada), que
# si es cross-origin. Se evaluo agregar el dominio de CloudFront automaticamente y se
# descarto: obliga a una revision nueva de la task definition sobre infra ya aplicada
# a cambio de cero efecto observable.
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "CORS_ORIGIN", value = var.cors_origin },
      { name = "SEED_DEMO_DATA", value = tostring(var.seed_demo_data) },
      # CloudFront -> ALB -> tarea: dos saltos antes de llegar aqui.
      { name = "TRUST_PROXY", value = "2" },
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    # Sin NAT Gateway las tareas necesitan IP publica para bajar la imagen de ECR.
    subnets          = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = !var.enable_nat_gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 60
  depends_on                        = [aws_lb_listener.http]

  # deploy-api.sh hace `force-new-deployment` con el mismo tag `latest`,
  # asi que Terraform no debe pelear por el numero de revision.
  lifecycle {
    ignore_changes = [task_definition]
  }
}
