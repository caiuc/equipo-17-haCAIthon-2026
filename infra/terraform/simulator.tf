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

    # El simulador atiende SIGTERM para cerrar los turnos abiertos antes de irse
    # (si no, quedan micros fantasma marcadas IN_TRANSIT que hay que limpiar a
    # mano). Los 30 s por defecto de ECS alcanzan, pero se declara explicito
    # porque el cierre masivo de 24 turnos se espera hasta 15 s: dejarlo implicito
    # invita a que alguien lo baje sin ver la relacion.
    stopTimeout = 30

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

# RATE LIMIT DEL LOGIN: esto ROMPIO la demo una vez. Queda documentado para que no
# se vuelva a armar sin querer.
#
# El simulador hace un login por micro contra /api/auth/login, y desde ECS todos
# salen por UNA SOLA IP -- la del NAT Gateway si enable_nat_gateway = true, o la IP
# publica de la tarea si es false -- asi que el API los ve como un unico cliente.
# El limite es `isProduction ? 30 : 300` por ventana de 15 minutos y por IP, y ese
# 300 NO aplica aqui: la tarea del API corre con NODE_ENV=production (lo pone
# ecs.tf), asi que el cupo real contra el despliegue son 30.
#
# Lo que paso con BUSES=40: 40 logins contra un cupo de 30 no caben NUNCA. El login
# 31 recibia 429, el simulador se moria, ECS relanzaba la tarea, y la tarea nueva
# gastaba otros 30 logins de una ventana ya agotada. Bucle de reinicio cada ~50 s y
# mapa sin micros por mas de media hora. Evidencia en el log: "El API corto los
# logins (429). Espera 881 s..." seguido de otro arranque 50 s despues.
#
# Arreglado en tres lugares, y los tres hacen falta:
#   1. apps/api/src/routes/auth.routes.ts: el limitador del LOGIN cuenta solo los
#      intentos FALLIDOS (skipSuccessfulRequests). La fuerza bruta se hace de
#      fallos, asi que la proteccion queda igual de firme -- de hecho mejor, porque
#      antes cualquiera podia agotar el cupo de una IP con 30 intentos y dejar
#      afuera a los usuarios legitimos. Los logins correctos del simulador ya no
#      cuentan. NO se subio el numero a ciegas: eso si habria aflojado el freno.
#   2. tools/simulator/index.ts: un 429 ya no mata el proceso. Se lee
#      RateLimit-Reset, se espera y se reintenta, y las micros que ya entraron
#      arrancan mientras tanto. Morir era la peor respuesta posible.
#   3. Aca abajo: min 0 / max 100 en el despliegue, para no tener dos simuladores
#      peleandose los mismos choferes.
#
# Si aun asi hiciera falta mas margen: enable_nat_gateway = true fija la IP de
# salida y permitiria una lista blanca por IP. Cuesta ~USD 32/mes.
resource "aws_ecs_service" "simulator" {
  name            = "${local.name}-simulator"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.simulator.arn
  desired_count   = var.simulator_desired_count
  launch_type     = "FARGATE"

  # DOS TAREAS A LA VEZ ES UN BUG, no una ventaja de disponibilidad.
  #
  # Con los valores por defecto (min 100 / max 200) un redespliegue levanta la
  # tarea nueva ANTES de bajar la vieja. Las dos usan los MISMOS choferes de
  # demo: la nueva adopta los turnos abiertos de la vieja y despues los cierra al
  # dar la vuelta, y la vieja se queda pingueando un tripId ya COMPLETED. Eso es
  # exactamente el 409 "El turno ya no esta en transito" que se vio repetido
  # cientos de veces en el log, con las micros congelandose en el mapa.
  #
  # min 0 / max 100 fuerza el orden contrario: primero para la vieja (que cierra
  # sus turnos con SIGTERM), despues arranca la nueva. Se pierden unos segundos
  # de movimiento en cada despliegue, que es un precio ridiculo al lado de esto.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

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
