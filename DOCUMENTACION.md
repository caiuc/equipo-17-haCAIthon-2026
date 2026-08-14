# Miqui — seguimiento en vivo de micros rurales

**Demo en producción: https://d6bg0tya67l5a.cloudfront.net**

---

## El problema

En zonas rurales de Chile nadie sabe si la micro ya pasó. No hay pantallas en el
paradero, la frecuencia es de 20 a 40 minutos y el horario impreso es
referencial. La gente espera sin información: puede que el bus venga en 3
minutos o que haya pasado hace 15 y toque esperar media hora.

A diferencia de Santiago, donde aplicaciones como Red muestran el recorrido en
tiempo real, en estas zonas esa información simplemente no existe.

**Miqui responde una sola pregunta, bien: ¿viene o no viene?**

---

## El principio que gobierna todas las decisiones

> **Nunca mostrar información sin declarar qué tan vieja es.**

En zona rural la señal se corta. Una aplicación que muestra una posición sin
indicar que tiene 8 minutos de antigüedad **es peor que no tener aplicación**:
genera confianza falsa y hace que alguien pierda la micro.

Esto no es una frase de presentación. Es una restricción que se puede verificar
en el código, y de la que se derivan decisiones concretas:

| Decisión | Por qué |
| --- | --- |
| Toda posición viaja con `recordedAt`, `ageSeconds` y `freshness` | El cliente nunca tiene que adivinar la antigüedad |
| Cuando la frescura es `NO_SIGNAL`, **la distancia llega en `null`** | Calcular distancia sobre una posición vieja es falsa precisión, y puede costar una micro perdida |
| Los umbrales viven en `packages/shared/src/constants.ts` | Si backend y frontend divergen, la interfaz miente. Un solo número, dos consumidores |
| **Sin ETA en minutos**, solo distancia en línea recta | No modelamos subida de pasajeros ni el trazado real del camino. Un ETA calculado sobre eso estaría malo, y un ETA malo genera exactamente la confianza falsa que queremos evitar |
| En el mapa, **solo se anima la micro en vivo** | Una micro sin señal que sigue deslizándose es una mentira en movimiento |
| Tarifa ausente ≠ tarifa cero | MuniBus Paine es gratuito de verdad; cuatro empresas simplemente no publican. Un `?? 0` haría que la app dijera "Gratis" donde no sabemos |

### Los cuatro estados de frescura

| Estado | Condición | Qué ve la persona |
| --- | --- | --- |
| **En vivo** | Última posición ≤ 30 s | "Actualizado hace 8 seg" |
| **Señal intermitente** | Entre 30 s y 2 min | "Última señal hace 48 s — puede haber avanzado" |
| **Sin señal** | Más de 2 min, turno abierto | "Sin señal hace 6 min — posición no confiable", **sin distancia** |
| **Fuera de servicio** | Ningún turno activo | "No hay micros en ruta ahora" |

El color no expresa la frescura, porque el color ya significa *empresa*. La
frescura se expresa con saturación, escala de grises y texto — así funciona
también para alguien daltónico o con el teléfono al sol.

---

## Cómo funciona

```
Chofer (teléfono)          API                        Pasajero
     │                      │                             │
     │  POST posición       │                             │
     │  cada 4 s            │                             │
     ├─────────────────────>│                             │
     │                      │  liveStore (memoria)        │
     │                      │  muestreo a Postgres        │
     │                      │  cada 15 s                  │
     │                      │                             │
     │                      │<────────────────────────────┤
     │                      │   GET /api/live/buses       │
     │                      │   cada 5 s                  │
     │                      ├────────────────────────────>│
     │                      │  posición + edad + frescura │
```

### Por qué HTTP y no WebSockets

La señal rural se corta. Un socket abierto obliga a manejar reconexión y estado
de sesión; **un `POST` que falla se reintenta solo en el siguiente tick y no
arrastra nada**.

Esto se ve funcionando en la demo: cuando una micro recupera señal tras un
apagón, el registro dice

```
[Buses Flota Talagante ISL-IDA] recupero senal: 4 posiciones en un POST
```

El teléfono acumuló lo que no pudo enviar y se puso al día en una sola petición.
No hubo reconexión que manejar.

### Por qué la última posición vive en memoria

El polling de los pasajeros no debe golpear la base de datos. La posición actual
vive en un `Map` en memoria; a Postgres baja **una muestra cada 15 segundos**.
El store se rehidrata al arrancar, así que un reinicio no borra las micros en
curso.

La consecuencia es una restricción dura: **el API no puede escalar a más de una
tarea** sin mover ese store a Redis. Con dos tareas, el chofer transmite a una y
el pasajero lee de la otra, y medio mapa desaparece sin ningún error visible.
Está bloqueado en Terraform con una `validation`, no solo documentado.

---

## Los datos: qué es real y qué no

Se sembraron **8 empresas rurales reales** de la Región Metropolitana. La regla
fue: **se siembra lo verificado, y lo que falta se declara pendiente**. Nunca se
inventa un número plausible.

| Empresa | Tipo | Recorridos | Paraderos | Tarifa adulto |
| --- | --- | --- | --- | --- |
| Buses Peñaflor (Bupesa) | Privada | 17 | 122 | $1.350 (según tramo) |
| Buses Flota Talagante | Privada | 6 | 46 | *por confirmar* |
| Islaval | Privada | 6 | 44 | *por confirmar* |
| Buses Damir | Privada | 4 | 22 | $1.100 |
| Buses Cobrexpress | Privada | 4 | 20 | $1.600 / $2.600 |
| Buses Paine | Privada | 6 | 46 | *por confirmar* |
| **MuniBus Paine** | **Municipal** | 14 | **533** | **Gratuito ($0)** |
| Buses de Acercamiento Colina | Municipal | 6 | 22 | *por confirmar* |

**Total: 63 recorridos, 855 paraderos, 113 tarifas, 18 choferes, 25 buses.**

Cada empresa guarda en la base de dónde salió su ficha (`sourceUrl`) y cuándo se
consultó (`sourceCheckedAt`), porque el principio rector aplica también al dato
estático.

### Tres detalles que muestran el criterio

**Los 533 paraderos de MuniBus son reales.** Su API pública expone 458 puntos
únicos con GPS del operador, en el orden real del itinerario. Es la única
empresa con geometría verificada, y así está declarado. El resto son
coordenadas a nivel de localidad.

**Las asimetrías se siembran, no se "corrigen".** El estudiante de Bupesa paga
$400 hacia Santiago y $450 de vuelta. Parece un error de transcripción; no lo
es, está así en el PDF oficial de la empresa. Se sembró tal cual.

**La tarifa de Damir es la vigente, no la que circula.** El artículo de prensa
más citado dice $1.300, pero es de julio de 2022 y lleva cuatro años vencido. La
vigente es $1.100. Sembrar la vieja habría sido presentar como actual un dato
caduco.

MuniBus Paine, además, **valida empíricamente una decisión de diseño**: su
recorrido T4 tiene 26 paradas de ida y 61 de vuelta. Los sentidos son
asimétricos en la realidad, que es exactamente por lo que en este sistema **cada
sentido es un recorrido propio**.

---

## Arquitectura

```
apps/api          Express 5 + Prisma + PostgreSQL
  prisma/seed/    8 empresas; data/ es data pura, sin Prisma
  src/services/   la logica; no conocen Request/Response
  src/routes/     routers por rol
  tools/simulator la flota simulada de la demo
frontend/         React 19 + Vite + Tailwind v4 + Google Maps
packages/shared   schemas zod y constantes — el contrato unico
infra/            Terraform: ECS Fargate, RDS, S3 + CloudFront
```

`@equipo17/shared` es lo que impide que la interfaz mienta: los umbrales de
frescura, los intervalos de polling y las formas de cada respuesta están
definidos **una vez** y los importan los dos lados.

### API público (sin token)

| Método | Ruta | Devuelve |
| --- | --- | --- |
| `GET` | `/api/live/buses?bbox=&stopId=` | Todas las micros vivas del mapa |
| `GET` | `/api/routes?q=` | Búsqueda de recorridos |
| `GET` | `/api/routes/:id` | Detalle con paraderos, horarios y tarifas |
| `GET` | `/api/routes/:id/live?stopId=` | Micros de un recorrido |
| `GET` | `/api/companies` | Fichas de empresa, con teléfono |
| `GET` | `/api/health` | Estado, incluida la integridad de migraciones |

El contrato completo está en `apps/api/openapi.yaml` (OpenAPI 3.1), servido en
`/api/openapi.yaml`.

El teléfono de la empresa no es un adorno: es la salida cuando no hay ninguna
micro transmitiendo. "Llámalos" es mejor respuesta que una pantalla vacía.

---

## La interfaz

Estética de Uber sobre Google Maps, pero con una diferencia de fondo. Donde Uber
lista UberX, UberXL y Green, Miqui lista **las micros que vienen**, cada una con
su empresa, su tarifa y su frescura.

El chip que en Uber dice "Faster" aquí dice "En vivo", "Señal intermitente" o
"Sin señal". Es el mismo lugar de la interfaz cumpliendo el propósito opuesto:
ellos venden velocidad, nosotros declaramos antigüedad.

Los vehículos son sprites del **Kenney Car Kit** (CC0), re-renderizados desde
los modelos 3D a 62° de elevación y recoloreados por empresa. Los PNG que trae
el kit están a 31°: al rotarlos según el rumbo, la micro queda con las ruedas
para arriba. El script de generación está en `tools/render-sprites/`.

---

## Levantarlo

```bash
pnpm install
pnpm db:up                                  # Postgres en Docker
pnpm db:migrate
pnpm --filter @equipo17/api seed            # las 8 empresas
pnpm dev                                    # api :3000 + web :5173

# En otra terminal: micros moviendose por el mapa
BUSES=12 pnpm --filter @equipo17/api simulate -- --seed=17
```

`--seed=17` hace la demo **reproducible**: la misma micro se queda muda en el
mismo segundo durante el ensayo y durante la presentación.

Cuentas de demo, todas con la clave `demo1234`: `superadmin@demo.cl`,
`pasajero@demo.cl`, y `admin@<empresa>.cl` / `chofer<n>@<empresa>.cl` para cada
una de las ocho.

### El simulador

Habla con el API **solo por HTTP**, igual que el teléfono de un chofer real. No
escribe en la base directamente, a propósito: así ejercita el mismo camino que
el sistema de verdad, incluidos la autenticación, la validación y los límites de
tasa. Un problema que aparece en el simulador es un problema real.

Reparte las micros **round-robin por empresa**, no por índice: con una lista
plana, doce micros salían todas de las dos primeras empresas y el mapa se veía
de un solo color.

Para demostrar la degradación de señal no basta con descartar paquetes al azar:
con ping cada 4 segundos y umbral de 30, harían falta ocho pérdidas seguidas,
que ocurren el 0,8 % de las veces. Por eso combina pérdida base con **apagones
de 35 a 70 segundos**, que hacen el ciclo visible y repetible frente a un
jurado.

---

## Seguridad

- Contraseñas con bcrypt, nunca en texto plano.
- Rutas privadas protegidas por JWT con verificación de rol.
- **Aislamiento multi-empresa**: el `companyId` se lee siempre del token, nunca
  del cuerpo ni de la URL. Un recorrido de otra empresa responde 404, no 403:
  no se confirma que exista.
- Validación con zod en el borde de toda entrada.
- Los errores devuelven código estándar y mensaje genérico, sin trazas.
- Helmet, límites de tasa y `trust proxy` configurado para ver la IP real.
- El endpoint masivo del mapa expone **solo el nombre de pila** del chofer:
  devolver el nombre completo de todos los choferes de todas las empresas cada 5
  segundos lo convertiría en un padrón descargable.

---

## Estado y limitaciones conocidas

**Funciona**: mapa en vivo multi-empresa, búsqueda de recorridos, panel de
empresa (recorridos, paraderos, horarios, choferes, flota), reporte
colaborativo de ocupación, y los cuatro estados de frescura.

**Limitaciones declaradas**:

- La transmisión web solo funciona con la aplicación en primer plano. El flujo
  del chofer asume teléfono montado y pantalla activa. Es una limitación
  conocida del prototipo, no una falla.
- No hay vista de conductor en la interfaz todavía; el flujo existe en el API.
- Las coordenadas de paraderos son aproximadas salvo las de MuniBus Paine.
- El API está limitado a una sola tarea por el store en memoria.

---

## Créditos y terceros

Assets, código de terceros, APIs externas y el uso de asistencia de IA están
declarados en el [README](README.md#código-y-assets-de-terceros), según la regla
11 de las bases.

Proyecto del **Equipo 17** para la HaCAithon 2026 del Centro de Alumnos de
Ingeniería UC. Licencia MIT.
