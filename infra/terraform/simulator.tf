# Servicio del simulador: micros falsas moviendose en el mapa desplegado.
#
# Por que existe: la demo no puede depender de que alguien tenga el notebook
# encendido con `pnpm simulate`. El jurado abre la URL desde su telefono, a la hora
# que sea, y tiene que ver micros moviendose. Eso significa que el simulador corre
# en la nube o no corre.
#
# Reusa EXACTAMENTE la misma imagen del API (mismo repositorio ECR, mismo tag), solo
# con otro `command`. Una segunda imagen significaria un segundo build que se puede
# olvidar, y un simulador hablando con una version del contrato distinta de la que
# sirve el API es un bug imposible de ver desde fuera.
#
# DEPENDENCIA PENDIENTE (esto todavia no funciona sin ella): apps/api/tsup.config.ts
# tiene que emitir dist/simulate.js, o sea agregar `simulate: 'tools/simulator.ts'`
# a su bloque `entry`. Hoy solo compila index y seed. Sin esa entry, la tarea arranca,
# no encuentra el archivo y muere en bucle. No se toca desde aqui a proposito: ese
# archivo es de otra persona ahora mismo (ver infra/README.md).

resource "aws_cloudwatch_log_group" "simulator" {
  name              = "/ecs/${local.name}-simulator"
  retention_in_days = 7
}

# SG propio, sin ningun ingress: el simulador solo habla hacia afuera (al ALB). Reusar
# el SG del API le abriria el puerto 3000 desde el ALB sin ninguna razon.
resource "aws_security_group" "simulator" {
  name        = "${local.name}-simulator"
  description = "Tarea del simulador: solo trafico de salida"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-simulator" }
}

resource "aws_ecs_task_definition" "simulator" {
  family                   = "${local.name}-simulator"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  # 0,25 vCPU / 512 MB: el simulador solo hace un POST por micro cada
  # DRIVER_PING_INTERVAL_MS y aritmetica de interpolacion. El cuello es la red.
  cpu    = 256
  memory = 512
  # Sin task_role: no toca ningun servicio de AWS, solo hace HTTP contra el ALB.
  execution_role_arn = aws_iam_role.execution.arn

  container_definitions = jsonencode([{
    name      = "simulator"
    image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    essential = true

    # Reemplaza al CMD de la imagen (node dist/index.js). El ENTRYPOINT sigue siendo
    # docker-entrypoint.sh, que sin DATABASE_URL se salta migraciones y seed y hace
    # exec directo de esto: no hay riesgo de que el simulador toque el esquema.
    command = ["node", "dist/simulate.js"]

    environment = concat([
      # Al ALB por dentro de la VPC, no a CloudFront: es un salto menos, no gasta
      # transferencia de CDN y no pasa por el rate limit del borde. El simulador es
      # el unico cliente al que le da igual no tener HTTPS.
      { name = "API_URL", value = "http://${aws_lb.api.dns_name}" },
      { name = "SIM_PASSWORD", value = var.simulator_password },
      { name = "NODE_ENV", value = "production" },
      ],
      var.simulator_buses != "" ? [{ name = "BUSES", value = var.simulator_buses }] : []
    )

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.simulator.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "simulator"
      }
    }
  }])
}

# AVISO - RATE LIMIT DEL LOGIN: esto se puede romper solo, y hay que saberlo antes.
#
# El simulador descubre empresas y choferes haciendo logins contra /api/auth/login:
# unos 18 por arranque (un login por micro, mas los 401 que marcan el tope de choferes
# de cada empresa; los 401 tambien consumen cupo). Desde ECS todos salen por UNA SOLA
# IP -- la del NAT Gateway si enable_nat_gateway = true, o la IP publica de la tarea si
# es false -- asi que el API los ve como un unico cliente.
#
# El limite en apps/api/src/routes/auth.routes.ts es `isProduction ? 30 : 300` por
# ventana de 15 minutos y por IP. OJO: ese 300 NO aplica aqui. La tarea del API corre
# con NODE_ENV=production (lo pone ecs.tf), asi que contra el despliegue el cupo real
# son 30. Cuentas: 18 caben una vez; dos arranques dentro de la misma ventana son 36 y
# el segundo se come 429s a mitad del descubrimiento.
#
# Lo peligroso es que ECS reintenta la tarea que muere. Si el simulador falla al
# arrancar (por 429, o porque falta dist/simulate.js), ECS la relanza, cada relanzada
# gasta mas cupo, y la ventana no se libera nunca: la demo queda muerta 15 minutos
# justo cuando alguien la esta mirando. Es exactamente el escenario "lo enciendo dos
# minutos antes de presentar y no levanta".
#
# Mitigaciones posibles, en orden de menos a mas invasivo. NINGUNA se implementa aqui:
# las tres primeras tocan codigo de apps/api, que hoy es de otra persona.
#   1. Operacional, gratis y suficiente para la demo: encender el servicio con
#      desired_count 1 al menos 20 minutos antes, mirar el log, y NO reiniciarlo. Si
#      hubo un 429, esperar la ventana completa antes de volver a intentar.
#   2. En el simulador (tools/simulator.ts): reintentar el login con backoff al
#      recibir 429 en vez de morir, y cortar el descubrimiento al primer 401 por
#      empresa. Baja el pico y evita el bucle de reinicios.
#   3. En el API (routes/auth.routes.ts): `skip` del authLimiter cuando la peticion
#      trae una cabecera con un secreto compartido de demo, inyectado aqui como
#      variable de entorno. Es la unica que elimina el problema de raiz sin aflojar
#      el limite para los usuarios reales -- que es lo que NO hay que hacer: ese
#      limite protege las credenciales de los choferes de verdad.
#   4. Infra: enable_nat_gateway = true fija la IP de salida, lo que permitiria una
#      lista blanca por IP. Cuesta ~USD 32/mes y no arregla el conteo por si solo.
resource "aws_ecs_service" "simulator" {
  name            = "${local.name}-simulator"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.simulator.arn
  desired_count   = var.simulator_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    # Igual que el API: sin NAT Gateway la tarea necesita IP publica para bajar la
    # imagen de ECR y para resolver/alcanzar el DNS publico del ALB.
    subnets          = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
    security_groups  = [aws_security_group.simulator.id]
    assign_public_ip = !var.enable_nat_gateway
  }

  # Sin load_balancer ni health check: no expone puertos, es un cliente.
  depends_on = [aws_lb_listener.http]

  lifecycle {
    # desired_count se mueve a mano con `aws ecs update-service` justo antes de la
    # demo (ver var.simulator_desired_count). Sin esto, el siguiente `terraform apply`
    # de cualquier otra cosa apagaria el simulador en medio de la presentacion.
    ignore_changes = [desired_count, task_definition]
  }
}
