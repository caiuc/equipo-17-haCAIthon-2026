/**
 * Simulador de choferes: micros falsas de varias empresas moviendo el mapa.
 *
 * Habla con el API por HTTP igual que el telefono de un chofer real -- el
 * sistema no usa WebSockets a proposito (ver CLAUDE.md): en zona rural la
 * conexion se corta, y un POST que falla se reintenta al siguiente tick sin
 * arrastrar el estado de una sesion abierta. Cuando una micro recupera la senal
 * vacia lo que acumulo en un solo POST por lote, que es exactamente el
 * argumento de esa decision.
 *
 * Las credenciales y las empresas salen del seed (prisma/seed/data), que es
 * data pura sin PrismaClient: importarla no siembra nada. Los ids de recorrido,
 * en cambio, los genera la base, asi que esos se preguntan al API.
 *
 * Uso:
 *   pnpm --filter @equipo17/api simulate
 *   BUSES=18 pnpm --filter @equipo17/api simulate -- --seed=17 --wait-for-api
 *   COMPANIES=bupesa,paine pnpm --filter @equipo17/api simulate
 *   pnpm --filter @equipo17/api simulate -- --cleanup
 *
 * Ctrl+C cierra los turnos abiertos antes de salir, para no dejar micros
 * fantasma marcadas como IN_TRANSIT. Un segundo Ctrl+C fuerza la salida y dice
 * que turnos quedaron abiertos.
 */
import { DRIVER_PING_INTERVAL_MS } from '@equipo17/shared';
import { decodePolyline, encodePolyline } from '../../src/lib/polyline.js';
import { COMPANIES, DEMO_PASSWORD } from '../../prisma/seed/data/index.js';
import { ApiError, crearCliente, sleep, type Cliente } from './apiClient.js';
import { AYUDA, parsearOpciones } from './cli.js';
import {
  buscarRutaInversa,
  filtrarEmpresas,
  fraccionDispersion,
  largoTotalM,
  repartirPorEmpresa,
  ubicarPorMetros,
} from './fleet.js';
import {
  PARADA_MAX_MS,
  PARADA_MIN_MS,
  avanzar,
  construirTrazado,
  estadoInicial,
  variacionDe,
  velocidadCruceroKmh,
} from './motion.js';
import { crearRng, enteroEntre, type Rng } from './rng.js';
import { crearSenal, planificarSenales } from './signal.js';
import type {
  Asignacion,
  EmpresaSemilla,
  Micro,
  Muestra,
  Opciones,
  RutaDetalle,
  RutaResumen,
} from './types.js';

type Contexto = { cliente: Cliente; opciones: Opciones; rng: Rng };

/** Descanso en el terminal antes de salir en el sentido contrario. */
const DESCANSO_MIN_MS = 15_000;
const DESCANSO_MAX_MS = 30_000;

/** Tope del buffer sin senal. postPositionsSchema acepta hasta 200 por lote. */
const MAX_BACKLOG = 180;

/** Cuanto se espera al cierre masivo antes de avisar que algo quedo abierto. */
const CIERRE_TIMEOUT_MS = 15_000;

/** Ventana en la que una segunda senal se considera un reenvio, no un segundo Ctrl+C. */
const REPETICION_SENAL_MS = 800;

/**
 * Latido en el log. Sin esto, diagnosticar una corrida de dias es adivinar: no
 * hay forma de distinguir "todo bien y en silencio" de "el proceso vive pero
 * ninguna micro se mueve".
 */
const LATIDO_MS = 3 * 60_000;

/**
 * Cada cuanto se le regenera la senal a una micro del perfil CORTE.
 *
 * senalDeCorte enmudece a los ~45 s y NO vuelve nunca: en una corrida de dias
 * esas micros quedan congeladas en el mapa para siempre, que es justo el sintoma
 * de "la simulacion dura poco". Regenerando la senal el ciclo se repite: ~45 s
 * en vivo, el resto envejeciendo. El backlog acumulado sale despues en un POST.
 */
const RENOVAR_CORTE_MS = 6 * 60_000;

/** Backoff para volver a abrir un turno que no se pudo crear. */
const REINTENTO_TURNO_MIN_MS = 5_000;
const REINTENTO_TURNO_MAX_MS = 60_000;

/** Fallos seguidos de una micro antes de empezar a espaciar sus pings. */
const FALLOS_ANTES_DE_BACKOFF = 3;
const BACKOFF_PING_MAX_MS = 60_000;

/**
 * Fallos seguidos antes de gritar una sola vez y despues callarse.
 *
 * Que 142 fallos identicos pasaran inadvertidos fue parte del bug: nadie se
 * entero hasta leer el log a mano. Se avisa con console.error en el numero
 * exacto y despues se calla, porque la repeticion es justamente lo que tapaba
 * el resto del log.
 */
const FALLOS_PARA_AVISO = 10;

/** Cuando el API no contesta se espera asi antes de rendirse en esa ronda. */
const ESPERA_API_MS = 10 * 60_000;

/** Espera por defecto ante un 429 sin cabecera: la ventana del limitador. */
const ESPERA_429_POR_DEFECTO_S = 900;

/** Tope de una sola espera por 429, por si el API declara un reset absurdo. */
const ESPERA_429_MAX_MS = 20 * 60_000;

/** Backoff del bucle de armado cuando no entro ni un chofer. */
const REINTENTO_FLOTA_MIN_MS = 15_000;
const REINTENTO_FLOTA_MAX_MS = 5 * 60_000;

/**
 * Cuantos choferes de cada empresa puede usar el simulador.
 *
 * EL SEED SIEMBRA chofer1..chofer6 POR EMPRESA. El simulador toma solo los
 * PRIMEROS CUATRO; chofer5 y chofer6 quedan reservados para personas.
 *
 * No es una preferencia, es una garantia. Desde que existe /chofer hay gente
 * manejando turnos de verdad desde el telefono, y el simulador adopta el turno
 * activo del chofer con el que entra (y lo cierra al dar la vuelta). Sin este
 * corte, un reinicio del servicio en mitad de la Feria le corta la transmision
 * al del jurado que esta probando la app, sin aviso y sin que nadie entienda por
 * que. Ya paso una vez con chofer6@bupesa.cl.
 *
 * Es una CONSTANTE y no una opcion a proposito: si se puede subir por variable
 * de entorno, alguien la sube a 6 para tener mas micros y la garantia se pierde
 * justo el dia que importa. El tope de micros pasa a ser 4 x empresas (32).
 */
const CHOFERES_DEL_SIMULADOR = 4;

/** Las empresas, recortadas a los choferes que el simulador tiene permitido usar. */
const reservarChoferes = (empresas: EmpresaSemilla[]): EmpresaSemilla[] =>
  empresas.map((empresa) => ({
    ...empresa,
    drivers: empresa.drivers.slice(0, CHOFERES_DEL_SIMULADOR),
  }));

/** Los que quedan libres para personas. Se listan al arrancar para que se sepan. */
const choferesDePersonas = (empresas: EmpresaSemilla[]): string[] =>
  empresas.flatMap((empresa) =>
    empresa.drivers.slice(CHOFERES_DEL_SIMULADOR).map((chofer) => chofer.email),
  );

const etiquetaDe = (empresa: string, codigo: string): string => `[${empresa} ${codigo}]`;

const micros: Micro[] = [];
const detalles = new Map<string, RutaDetalle>();
let contexto: Contexto | null = null;
let cerrando = false;
let cerrandoDesde = 0;

/**
 * Estado del supervisor, fuera del tipo Micro a proposito: types.ts describe el
 * contrato con el resto del simulador y esto es contabilidad de este archivo.
 * Todos van indexados por micro.indice, asi que crecen con la flota y no con el
 * tiempo -- en una corrida de dias eso es la diferencia entre un mapa y una fuga.
 */
const esperaTurnoMs = new Map<number, number>();
const microsCorriendo = new Set<number>();
let senalesAplicadas = false;
let reconexion: Promise<void> | null = null;

/** Cuantas veces se solto un turno muerto. Solo para el latido. */
let turnosRecuperados = 0;

const humanizarMs = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  if (horas > 0) return `${horas}h ${minutos}m`;
  return minutos > 0 ? `${minutos}m ${total % 60}s` : `${total}s`;
};

/**
 * Una sola sonda de salud para toda la flota.
 *
 * Si el API se cae, las 40 micros fallan en el mismo tick. Que cada una abra su
 * propio esperarApi son 40 GET /api/health por segundo contra un servidor que ya
 * esta en problemas: se comparte la misma promesa y todas despiertan juntas.
 */
const esperarApiVivo = (ctx: Contexto): Promise<void> => {
  reconexion ??= ctx.cliente
    .esperarApi(ESPERA_API_MS)
    .catch(() => undefined)
    .finally(() => {
      reconexion = null;
    });
  return reconexion;
};

// --- Lecturas del API ---

const detalleDeRuta = async (ctx: Contexto, routeId: string): Promise<RutaDetalle | null> => {
  const guardado = detalles.get(routeId);
  if (guardado) return guardado;

  const detalle = await ctx.cliente.pedir<RutaDetalle>(`/api/routes/${routeId}`).catch(() => null);
  // Sin al menos dos paraderos no hay tramo que interpolar.
  if (!detalle || detalle.stops.length < 2) return null;
  detalles.set(routeId, detalle);
  return detalle;
};

const turnoActivo = async (
  ctx: Contexto,
  token: string,
): Promise<{ id: string; routeId: string } | null> =>
  ctx.cliente
    .pedir<{ trip: { id: string; routeId: string } | null }>('/api/driver/trips/active', { token })
    .then((datos) => datos.trip)
    .catch(() => null);

/**
 * En `--cleanup` (comando de una sola pasada, alguien mirando la consola) un 429
 * se explica y se corta: hacer esperar 15 minutos a una persona en la terminal
 * no es servicio, es un cuelgue. El servicio de larga duracion NO usa esto: ver
 * entrarConEspera.
 */
const explicarRateLimit = (error: ApiError): Error =>
  new Error(
    `El API corto los logins (429). Espera ${error.resetSegundos ?? ESPERA_429_POR_DEFECTO_S} s, ` +
      'o levanta AUTH_RATE_LIMIT en apps/api/src/routes/auth.routes.ts.',
  );

/**
 * Login que espera el rate limit en vez de morirse.
 *
 * ESTE ES EL BUCLE DE REINICIOS QUE MATABA LA DEMO. El limite de /api/auth es 30
 * por 15 minutos y por IP; desde ECS las 40 micros salen por UNA sola IP. El
 * arranque numero 31 recibia 429, el error subia hasta main, el proceso moria,
 * ECS relanzaba la tarea, y la tarea nueva gastaba otros 30 logins de una ventana
 * que ya estaba agotada. La ventana no se liberaba nunca.
 *
 * Esperar el reset es lo unico que rompe el bucle: cuesta una pausa una sola vez
 * y despues la flota corre por dias con los mismos tokens (JWT_EXPIRES_IN=12h,
 * y al vencer se vuelve a entrar con este mismo camino).
 */
const entrarConEspera = async (
  ctx: Contexto,
  email: string,
  password: string,
): Promise<string | null> => {
  for (;;) {
    if (cerrando) return null;

    const resultado = await ctx.cliente.login(email, password).then(
      (token) => ({ ok: true as const, token }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    if (resultado.ok) return resultado.token;

    const error = resultado.error;
    if (error instanceof ApiError && error.status === 429) {
      const segundos = error.resetSegundos ?? ESPERA_429_POR_DEFECTO_S;
      const espera = Math.min(Math.max(segundos, 1) * 1000, ESPERA_429_MAX_MS);
      console.warn(
        `Rate limit de login alcanzado (${email}). Espera ${humanizarMs(espera)} y reintenta. ` +
          'La flota que ya entro sigue moviendose.',
      );
      // Y que sea verdad: las micros ya armadas arrancan antes de la espera, en
      // vez de dejar el mapa vacio hasta que se libere la ventana.
      if (micros.length > 0) {
        aplicarSenales(ctx);
        arrancarPendientes(ctx);
      }
      await sleep(espera);
      continue;
    }

    // 401/400: credenciales o payload. Reintentar no lo arregla y gasta cupo.
    if (error instanceof ApiError && error.status < 500) {
      console.warn(`${email} no pudo entrar: ${error.message}`);
      return null;
    }

    // Red caida o 5xx: se espera a que el API vuelva y se reintenta.
    console.warn(`${email} no pudo entrar (${(error as Error).message}); esperando al API`);
    await esperarApiVivo(ctx);
  }
};

// --- Ciclo de vida del turno ---

/**
 * Deja a la micro con un turno abierto.
 *
 * Consulta el turno activo ANTES de intentar crear uno: si quedo abierto de una
 * corrida anterior hay que adoptarlo con SU recorrido. El simulador viejo
 * adoptaba el tripId pero seguia moviendose por el recorrido nuevo, o sea que
 * emitia posiciones sobre un trazado ajeno.
 */
const iniciarTurno = async (ctx: Contexto, micro: Micro): Promise<void> => {
  const activo = await turnoActivo(ctx, micro.token);

  if (activo) {
    micro.tripId = activo.id;
    if (activo.routeId !== micro.ruta.id) {
      const adoptada = await detalleDeRuta(ctx, activo.routeId);
      if (adoptada) {
        micro.ruta = adoptada;
        ubicarEnRuta(micro);
      }
    }
    console.log(`${micro.etiqueta} adopta el turno abierto ${activo.id} en ${micro.ruta.code}`);
    return;
  }

  const creado = await ctx.cliente
    .pedir<{ trip: { id: string } }>('/api/driver/trips/start', {
      method: 'POST',
      token: micro.token,
      body: { routeId: micro.ruta.id },
    })
    .catch(async (error: unknown) => {
      console.warn(`${micro.etiqueta} no pudo iniciar turno: ${(error as Error).message}`);

      // 404 = el recorrido que la micro tiene cacheado ya no existe: lo borro un
      // reseed, o la empresa lo desactivo desde el panel. Reintentar con el mismo
      // id es pedir para siempre algo que no va a volver, asi que se tira el cache
      // y se vuelve a preguntar cual recorrido le toca. En una corrida de dias
      // esto pasa cada vez que alguien edita el catalogo.
      if (error instanceof ApiError && error.status === 404) await recargarRuta(ctx, micro);
      return null;
    });

  // Antes esto marcaba la micro como terminada y su bucle salia para siempre:
  // con la flota entera fallando, TODOS los bucles salian, main resolvia y el
  // proceso se moria "con exito". Ahora no se da de baja a nadie; asegurarTurno
  // reintenta con backoff hasta que el API acepte.
  if (creado) micro.tripId = creado.trip.id;
};

/**
 * Le busca un recorrido nuevo a una micro cuyo recorrido desaparecio.
 *
 * Se vuelve a preguntar `/api/driver/routes` (sin cache: la lista vieja tiene los
 * ids muertos) y se toma el primero que tenga paraderos. Sin esto, una micro que
 * pierde su recorrido queda pidiendo un id inexistente hasta que alguien reinicie
 * el proceso.
 */
const recargarRuta = async (ctx: Contexto, micro: Micro): Promise<void> => {
  detalles.delete(micro.ruta.id);

  const rutas = await ctx.cliente
    .pedir<{ routes: RutaResumen[] }>('/api/driver/routes', { token: micro.token })
    .then((datos) => datos.routes)
    .catch(() => []);
  if (rutas.length === 0) return;

  micro.rutasDeEmpresa = rutas;
  for (const resumen of rutas) {
    const detalle = await detalleDeRuta(ctx, resumen.id);
    if (!detalle) continue;
    micro.ruta = detalle;
    micro.etiqueta = etiquetaDe(micro.empresaNombre, detalle.code);
    ubicarEnRuta(micro);
    console.log(`${micro.etiqueta} recupero recorrido: ahora corre ${detalle.code}`);
    return;
  }
};

/**
 * Deja a la micro con turno, o espera para reintentar.
 *
 * El backoff sube hasta REINTENTO_TURNO_MAX_MS para no martillar al API cuando
 * el problema es del otro lado, y se resetea al primer exito.
 */
const asegurarTurno = async (ctx: Contexto, micro: Micro): Promise<void> => {
  if (cerrando || micro.tripId || micro.terminada) return;

  await iniciarTurno(ctx, micro);
  if (micro.tripId) {
    esperaTurnoMs.delete(micro.indice);
    return;
  }

  const previa = esperaTurnoMs.get(micro.indice) ?? 0;
  const espera = Math.min(
    previa === 0 ? REINTENTO_TURNO_MIN_MS : previa * 2,
    REINTENTO_TURNO_MAX_MS,
  );
  esperaTurnoMs.set(micro.indice, espera);
  await sleep(espera);
};

const finalizarTurno = async (ctx: Contexto, micro: Micro): Promise<void> => {
  const tripId = micro.tripId;
  if (!tripId) return;

  await ctx.cliente
    .pedir(`/api/driver/trips/${tripId}/end`, { method: 'POST', token: micro.token })
    .then(() => {
      micro.tripId = null;
    })
    .catch((error: unknown) => {
      // 409 (ya finalizado) y 404 significan que el turno NO quedo abierto: se
      // olvida igual, o el resumen de salida acusaria micros fantasma que no
      // existen y mandaria al equipo a un --cleanup inutil.
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        micro.tripId = null;
        return;
      }
      // El tripId se conserva: al salir hay que poder decir que quedo abierto.
      console.warn(`${micro.etiqueta} no pudo cerrar el turno: ${(error as Error).message}`);
    });
};

// --- Movimiento y emision ---

const ubicarEnRuta = (micro: Micro): void => {
  micro.trazado = construirTrazado(micro.ruta.stops, micro.ruta.pathPolyline ?? null);
  // La dispersion se reparte sobre el camino REAL: con el trazado por calles el
  // recorrido mide bastante mas que la suma de rectas, y repartir sobre las
  // rectas amontonaria las micros en la primera mitad.
  const ubicacion = ubicarPorMetros(micro.trazado.puntos, fraccionDispersion(micro.indice));
  micro.estado = estadoInicial(micro.trazado, ubicacion);
  // La velocidad sale del espaciado de los PARADEROS, no de los vertices del
  // camino: entre vertices hay metros, y cualquier recorrido pareceria urbano.
  micro.velocidadKmh = velocidadCruceroKmh(micro.ruta.stops) * micro.variacion;
};

/**
 * Manda la posicion, o la guarda si esta sin senal.
 *
 * Al recuperar la senal el backlog sale en UN solo POST por lote: es la rama de
 * postPositionsSchema que acepta { positions: [...] } y que en la practica no se
 * ejercitaba nunca.
 */
const emitir = async (ctx: Contexto, micro: Micro, muestra: Muestra): Promise<void> => {
  const tripId = micro.tripId;
  if (!tripId) return;

  if (!micro.senal.transmite(muestra.timestamp)) {
    micro.backlog.push(muestra);
    if (micro.backlog.length > MAX_BACKLOG) micro.backlog.shift();
    return;
  }

  const lote = [...micro.backlog, muestra];
  micro.backlog.length = 0;
  const primera = lote[0];
  if (!primera) return;

  await ctx.cliente
    .pedir(`/api/driver/trips/${tripId}/positions`, {
      method: 'POST',
      token: micro.token,
      body: lote.length === 1 ? primera : { positions: lote },
      // Un solo reintento: una posicion vieja no sirve de nada y en el proximo
      // tick sale una mejor. Insistir solo atrasaria a esta micro.
      reintentos: 1,
    })
    .then(() => {
      if (lote.length > 1) {
        console.log(`${micro.etiqueta} recupero senal: ${lote.length} posiciones en un POST`);
      }
      micro.fallos = 0;
    })
    .catch((error: unknown) => {
      // Un POST que salio antes del cierre y aterrizo despues recibe un 409 que
      // no significa nada: se descarta en silencio para no ensuciar la salida.
      if (cerrando) return;

      // FALLO DEFINITIVO, no transitorio. 409 (turno ya no esta en transito) y
      // 404 (turno no encontrado) dicen que ese trip esta COMPLETED en la base y
      // no vuelve jamas: lo cerro un redespliegue, un --cleanup, u otra tarea del
      // simulador. Reintentarlo es garantizar que la micro NO vuelva al mapa
      // nunca -- se vieron 142 reintentos seguidos del mismo 409 y produccion
      // bajando de 18 micros a 1. Se suelta el turno muerto y se abre otro.
      //
      // Ojo con la distincion: un fetch caido, un timeout o un 5xx SI son
      // transitorios y se reintentan al siguiente tick. Esa es la decision de
      // "HTTP y no WebSockets" de CLAUDE.md y no se toca.
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        console.warn(
          `${micro.etiqueta} turno cerrado por el servidor (${error.status}), reabriendo`,
        );
        micro.tripId = null;
        // El backlog era de un turno que ya no existe: postearlo al turno nuevo
        // seria escribir posiciones viejas como si fueran del viaje nuevo.
        micro.backlog.length = 0;
        // No suma a micro.fallos: no es un ping perdido, es un turno perdido.
        turnosRecuperados += 1;
        return;
      }

      // Un ping perdido es normal en terreno: se reintenta en el siguiente tick.
      micro.fallos += 1;
      if (micro.fallos === FALLOS_PARA_AVISO) {
        console.error(
          `${micro.etiqueta} lleva ${micro.fallos} pings fallidos seguidos. ` +
            `Ultimo: ${(error as Error).message}`,
        );
      } else if (micro.fallos < FALLOS_PARA_AVISO) {
        console.warn(`${micro.etiqueta} ping fallido (${micro.fallos}):`, (error as Error).message);
      }
      // Pasado el aviso se deja de loguear cada tick: 40 micros por un API caido
      // son 10 lineas por segundo que tapan el latido y no dicen nada nuevo.
      micro.backlog = lote.slice(-MAX_BACKLOG);
    });
};

const invertirRuta = (ruta: RutaDetalle): RutaDetalle => ({
  ...ruta,
  originName: ruta.destinationName,
  destinationName: ruta.originName,
  stops: [...ruta.stops].reverse(),
  // El trazado tambien se da vuelta. Puede quedar contra el sentido de alguna
  // calle de una via, pero es el camino: mejor eso que la recta que cruza el rio.
  pathPolyline: ruta.pathPolyline
    ? encodePolyline(decodePolyline(ruta.pathPolyline).reverse())
    : null,
});

/**
 * Llego al terminal: da la vuelta.
 *
 * Cada sentido es un recorrido propio, asi que la vuelta es otro turno sobre el
 * recorrido inverso. El turno nuevo se abre ANTES del descanso para que la micro
 * quede visible detenida en el terminal en vez de desaparecer del mapa.
 */
const darLaVuelta = async (ctx: Contexto, micro: Micro): Promise<void> => {
  const terminal = micro.ruta.stops.at(-1)?.name ?? micro.ruta.destinationName;
  console.log(`${micro.etiqueta} llego a ${terminal}`);

  await finalizarTurno(ctx, micro);
  if (ctx.opciones.unaVuelta || cerrando) {
    micro.terminada = true;
    return;
  }

  const inversa = buscarRutaInversa(micro.ruta, micro.rutasDeEmpresa);
  const detalle = inversa ? await detalleDeRuta(ctx, inversa.id) : null;
  // Sin sentido contrario publicado se invierte el trazado del mismo recorrido:
  // es peor que tener la vuelta cargada, pero mucho mejor que teletransportar la
  // micro al origen, que es lo que hacia el simulador viejo.
  micro.ruta = detalle ?? invertirRuta(micro.ruta);

  await iniciarTurno(ctx, micro);
  micro.trazado = construirTrazado(micro.ruta.stops, micro.ruta.pathPolyline ?? null);
  micro.estado = estadoInicial(micro.trazado, { tramo: 0, avance: 0 });
  micro.estado.detenidoHasta = Date.now() + enteroEntre(ctx.rng, DESCANSO_MIN_MS, DESCANSO_MAX_MS);
  micro.velocidadKmh = velocidadCruceroKmh(micro.ruta.stops) * micro.variacion;
};

const tick = async (ctx: Contexto, micro: Micro): Promise<void> => {
  // Un tick en vuelo despues del cierre postearia a un turno COMPLETED y
  // recibiria un 409 que no significa nada.
  if (cerrando || !micro.tripId) return;

  const ahora = Date.now();
  const salida = avanzar({
    trazado: micro.trazado,
    estado: micro.estado,
    velocidadKmh: micro.velocidadKmh,
    deltaMs: DRIVER_PING_INTERVAL_MS,
    ahora,
    ruido: ctx.rng(),
    sorteoParada: ctx.rng(),
    duracionParadaMs: enteroEntre(ctx.rng, PARADA_MIN_MS, PARADA_MAX_MS),
  });
  micro.estado = salida.estado;

  // Detenida en el paradero SE SIGUE emitiendo, con speed 0: dejar de emitir
  // degradaria la frescura y estariamos mintiendo sobre el motivo.
  await emitir(ctx, micro, {
    latitude: salida.estado.punto.lat,
    longitude: salida.estado.punto.lng,
    speed: Math.round(salida.speedKmh),
    heading: Math.round(salida.estado.heading) % 360,
    timestamp: ahora,
  });

  if (salida.fin) await darLaVuelta(ctx, micro);
};

/**
 * Espera extra cuando una micro acumula fallos de red seguidos.
 *
 * No es para el 409 (ese ya se resuelve reabriendo el turno): es para el API
 * caido. Sin esto, 40 micros golpean cada 4 s un servidor que no contesta.
 */
const esperaPorFallos = (fallos: number): number => {
  if (fallos < FALLOS_ANTES_DE_BACKOFF) return 0;
  const factor = 2 ** Math.min(fallos - FALLOS_ANTES_DE_BACKOFF, 10);
  return Math.min(DRIVER_PING_INTERVAL_MS * factor, BACKOFF_PING_MAX_MS);
};

/**
 * Bucle propio por micro: una excepcion en una micro no puede cortar la corrida
 * completa, y el desfase reparte las conexiones dentro del intervalo de ping.
 *
 * El bucle NO termina solo. Antes salia cuando la micro quedaba `terminada`, y
 * como eso pasaba en bloque (todas fallaban el mismo start), main resolvia y el
 * proceso se moria "sin error". Un servicio que se apaga solo es un servicio que
 * ECS reinicia, y cada reinicio empeora el rate limit.
 */
const correr = async (ctx: Contexto, micro: Micro, desfaseMs: number): Promise<void> => {
  await sleep(desfaseMs);

  while (!cerrando && !micro.terminada) {
    // Sin turno (nunca lo tuvo, o el servidor se lo cerro por debajo): se abre
    // uno antes de moverse. asegurarTurno ya trae su propio backoff.
    if (!micro.tripId) {
      await asegurarTurno(ctx, micro).catch((error: unknown) => {
        console.warn(`${micro.etiqueta} no pudo reabrir turno:`, (error as Error).message);
      });
      if (!micro.tripId) continue;
    }

    await tick(ctx, micro).catch((error: unknown) => {
      micro.fallos += 1;
      if (micro.fallos <= FALLOS_PARA_AVISO) {
        console.warn(`${micro.etiqueta} tick fallido (${micro.fallos}):`, (error as Error).message);
      }
    });

    const castigo = esperaPorFallos(micro.fallos);
    // Con muchos fallos seguidos el problema no es de esta micro: se espera a que
    // el API conteste (una sola sonda para toda la flota) en vez de insistir.
    if (micro.fallos >= FALLOS_PARA_AVISO) await esperarApiVivo(ctx);
    await sleep(DRIVER_PING_INTERVAL_MS + castigo);
  }
};

/**
 * Arranca el bucle de las micros que todavia no corren.
 *
 * Se llama mas de una vez a proposito: si el armado de la flota se topa con el
 * rate limit y tiene que esperar la ventana, las micros que YA entraron empiezan
 * a moverse mientras tanto. Un mapa con 30 micros mientras entran las otras 10 es
 * mucho mejor que un mapa vacio durante quince minutos.
 */
const arrancarPendientes = (ctx: Contexto): void => {
  const total = Math.max(micros.length, 1);
  for (const micro of micros) {
    if (microsCorriendo.has(micro.indice)) continue;
    microsCorriendo.add(micro.indice);
    const desfase = Math.round((DRIVER_PING_INTERVAL_MS * micro.indice) / total);
    // Sin await: cada micro vive en su propio bucle. El .catch es el ultimo
    // seguro -- si aun asi se cayera, se cae UNA micro, no el proceso.
    void correr(ctx, micro, desfase).catch((error: unknown) => {
      console.error(`${micro.etiqueta} bucle caido:`, (error as Error).message);
      microsCorriendo.delete(micro.indice);
    });
  }
};

// --- Armado de la flota ---

const rutasDeChofer = async (
  ctx: Contexto,
  token: string,
  cache: Map<string, RutaResumen[]>,
  slug: string,
): Promise<RutaResumen[]> => {
  const guardadas = cache.get(slug);
  if (guardadas) return guardadas;

  // Los recorridos salen del propio chofer: startTrip rechaza uno de otra
  // empresa, asi que adivinar el cruce empresa-recorrido no sirve.
  const rutas = await ctx.cliente
    .pedir<{ routes: RutaResumen[] }>('/api/driver/routes', { token })
    .then((datos) => datos.routes)
    .catch(() => []);
  cache.set(slug, rutas);
  return rutas;
};

/**
 * Asignaciones que no llegaron a ser micro (login caido, empresa sin recorridos).
 * El bucle principal las reintenta en segundo plano: es mucho mejor salir con 12
 * micros y completar las 24 despues que quedarse en cero esperando a todas.
 */
const pendientesDeEntrar: Asignacion[] = [];

const armarFlota = async (ctx: Contexto, asignaciones: Asignacion[]): Promise<void> => {
  const password = ctx.opciones.password ?? DEMO_PASSWORD;
  const rutasPorEmpresa = new Map<string, RutaResumen[]>();
  const usadas = new Set<string>(micros.map((micro) => micro.ruta.id));

  for (const [indice, asignacion] of asignaciones.entries()) {
    // Login escalonado y secuencial: veinte bcrypt concurrentes clavan el event
    // loop del API justo cuando el jurado esta mirando el mapa.
    if (indice > 0) await sleep(ctx.opciones.staggerMs);
    if (cerrando) return;

    // Un chofer ya montado no se monta dos veces: el reintento en segundo plano
    // pasa por aca con la lista de pendientes y no puede duplicar micros.
    if (micros.some((micro) => micro.email === asignacion.email)) continue;

    const token = await entrarConEspera(ctx, asignacion.email, password);
    if (!token) {
      pendientesDeEntrar.push(asignacion);
      continue;
    }

    const rutas = await rutasDeChofer(ctx, token, rutasPorEmpresa, asignacion.empresaSlug);
    if (rutas.length === 0) {
      console.warn(`${asignacion.empresaNombre} no tiene recorridos activos, se omite`);
      continue;
    }

    const activo = await turnoActivo(ctx, token);
    // Se prefiere un recorrido que nadie este sirviendo; si ya se dio la vuelta
    // completa, se reparte por ordinal.
    const preferidas = activo
      ? []
      : [
          ...rutas.filter((ruta) => !usadas.has(ruta.id)),
          ...rutas.filter((ruta) => usadas.has(ruta.id)),
        ];
    const candidatas = activo ? [activo.routeId] : preferidas.map((ruta) => ruta.id);

    let ruta: RutaDetalle | null = null;
    for (const routeId of candidatas) {
      ruta = await detalleDeRuta(ctx, routeId);
      if (ruta) break;
    }
    if (!ruta) {
      console.warn(`${asignacion.email} no tiene recorridos con paraderos, se omite`);
      continue;
    }
    usadas.add(ruta.id);

    const indiceMicro = micros.length;
    const variacion = variacionDe(ctx.rng());
    const trazado = construirTrazado(ruta.stops, ruta.pathPolyline ?? null);
    const micro: Micro = {
      indice: indiceMicro,
      etiqueta: etiquetaDe(asignacion.empresaNombre, ruta.code),
      empresaSlug: asignacion.empresaSlug,
      empresaNombre: asignacion.empresaNombre,
      email: asignacion.email,
      token,
      ruta,
      trazado,
      rutasDeEmpresa: rutas,
      tripId: activo?.id ?? null,
      perfil: 'BUENA',
      senal: crearSenal('BUENA', ctx.rng, Date.now()),
      variacion,
      velocidadKmh: velocidadCruceroKmh(ruta.stops) * variacion,
      estado: estadoInicial(
        trazado,
        ubicarPorMetros(trazado.puntos, fraccionDispersion(indiceMicro)),
      ),
      backlog: [],
      fallos: 0,
      terminada: false,
    };

    // Se registra ANTES de iniciar el turno: con 18 micros y login escalonado son
    // varios segundos en los que un Ctrl+C dejaria turnos fantasma IN_TRANSIT.
    micros.push(micro);
  }
};

/**
 * Aplica el plan de senales y empareja cada micro degradada con su espejo sano.
 *
 * Corre UNA sola vez: reasigna recorridos (la micro degradada se muda al corredor
 * de su espejo) y repetirlo sobre una flota a medio armar mudaria micros que ya
 * estan en ruta.
 */
const aplicarSenales = (ctx: Contexto): void => {
  if (senalesAplicadas) return;
  senalesAplicadas = true;

  const plan = planificarSenales(
    micros.map((micro) => micro.empresaSlug),
    ctx.opciones,
  );
  const inicio = Date.now();

  plan.forEach((entrada, indice) => {
    const micro = micros[indice];
    if (!micro) return;
    micro.perfil = entrada.perfil;
    micro.senal = crearSenal(entrada.perfil, ctx.rng, inicio);

    const espejo = entrada.espejo === null ? null : micros[entrada.espejo];
    // Una micro que adopto un turno abierto no se mueve de recorrido: el turno
    // ya esta atado al suyo.
    if (!espejo || micro.tripId) return;
    micro.ruta = espejo.ruta;
    micro.rutasDeEmpresa = espejo.rutasDeEmpresa;
    micro.etiqueta = etiquetaDe(micro.empresaNombre, espejo.ruta.code);
    ubicarEnRuta(micro);
  });
};

/**
 * Le devuelve la senal a las micros del perfil CORTE.
 *
 * senalDeCorte enmudece a los ~45 s y no vuelve NUNCA. En una demo de cinco
 * minutos eso es exactamente lo que se quiere mostrar; en un servicio de dias
 * son micros congeladas en el mapa para siempre. Regenerando la senal el ciclo
 * se repite: un rato en vivo, un rato envejeciendo, y el backlog acumulado sale
 * despues en un solo POST por lote.
 */
const renovarSenales = (ctx: Contexto): void => {
  const ahora = Date.now();
  let renovadas = 0;

  for (const micro of micros) {
    if (micro.perfil !== 'CORTE' || micro.terminada) continue;
    micro.senal = crearSenal('CORTE', ctx.rng, ahora);
    renovadas += 1;
  }

  if (renovadas > 0) console.log(`Senal renovada en ${renovadas} micros del perfil CORTE.`);
};

/**
 * Latido: una linea cada pocos minutos para poder diagnosticar sin adivinar.
 *
 * Que 142 fallos identicos seguidos pasaran inadvertidos fue parte del bug. Con
 * esto, "las micros dejaron de moverse" se ve en el log en vez de descubrirse
 * mirando el mapa.
 */
const latir = (): void => {
  const activas = micros.filter((micro) => !micro.terminada).length;
  const abiertos = micros.filter((micro) => micro.tripId !== null).length;
  const sinTurno = micros.filter((micro) => !micro.terminada && micro.tripId === null).length;
  const fallando = micros.filter((micro) => micro.fallos > 0).length;
  const acumulando = micros.filter((micro) => micro.backlog.length > 0).length;
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  console.log(
    `Latido | ${activas} micros activas | ${abiertos} turnos abiertos | ` +
      `${sinTurno} sin turno | ${fallando} con pings fallidos | ` +
      `${acumulando} acumulando backlog | ${turnosRecuperados} turnos reabiertos | ` +
      `RSS ${rssMb} MB | ${humanizarMs(process.uptime() * 1000)} en pie`,
  );

  // Que el latido no solo informe: si NADIE tiene turno el simulador esta vivo
  // pero el mapa esta vacio, y eso hay que poder verlo de un vistazo.
  if (activas > 0 && abiertos === 0) {
    console.error('Latido: ninguna micro tiene turno abierto. El mapa esta vacio.');
  }
};

const resumirFlota = (): void => {
  for (const micro of micros) {
    // Los km salen del trazado por el que de verdad va a circular: con el camino
    // real son bastantes mas que la suma de rectas entre paraderos.
    const km = (largoTotalM(micro.trazado.puntos) / 1000).toFixed(1);
    console.log(
      `  ${micro.etiqueta} ${micro.email} ${micro.ruta.name} | ${km} km | ` +
        `${Math.round(micro.velocidadKmh)} km/h | senal ${micro.perfil} | ` +
        (micro.trazado.porCalles ? 'por calles' : 'sin trazado (recta)'),
    );
  }
  const porPerfil = micros.reduce<Record<string, number>>((cuenta, micro) => {
    cuenta[micro.perfil] = (cuenta[micro.perfil] ?? 0) + 1;
    return cuenta;
  }, {});
  const empresas = new Set(micros.map((micro) => micro.empresaSlug));
  const porCalles = micros.filter((micro) => micro.trazado.porCalles).length;
  console.log(
    `Micros: ${micros.length} en ${empresas.size} empresas | ` +
      Object.entries(porPerfil)
        .map(([perfil, cuantas]) => `${perfil}: ${cuantas}`)
        .join(' | '),
  );
  // Si esto dice 0, falta correr `pnpm --filter @equipo17/api trazados`: las
  // micros se van a ver cruzando en diagonal y conviene saberlo antes de la demo.
  console.log(
    `Trazado por calles: ${porCalles}/${micros.length} ` +
      (porCalles === micros.length
        ? ''
        : '(las demas interpolan entre paraderos; calcula los trazados con ' +
          '`pnpm --filter @equipo17/api trazados`)'),
  );
};

/**
 * Cierra los turnos que quedaron abiertos de una corrida anterior.
 *
 * Sin esto, la unica salida despues de un `kill -9` era entrar a prisma studio a
 * marcar los turnos a mano.
 */
const limpiar = async (ctx: Contexto, empresas: EmpresaSemilla[]): Promise<void> => {
  const password = ctx.opciones.password ?? DEMO_PASSWORD;
  const choferes = empresas.flatMap((empresa) =>
    empresa.drivers.map((chofer) => ({ email: chofer.email, empresa: empresa.name })),
  );
  let cerrados = 0;

  for (const [indice, chofer] of choferes.entries()) {
    if (indice > 0) await sleep(ctx.opciones.staggerMs);

    const token = await ctx.cliente.login(chofer.email, password).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 429) throw explicarRateLimit(error);
      return null;
    });
    if (!token) continue;

    const activo = await turnoActivo(ctx, token);
    if (!activo) continue;

    await ctx.cliente
      .pedir(`/api/driver/trips/${activo.id}/end`, { method: 'POST', token })
      .then(() => {
        cerrados += 1;
        console.log(`Cerrado ${activo.id} (${chofer.empresa}, ${chofer.email})`);
      })
      .catch((error: unknown) =>
        console.warn(`No se pudo cerrar ${activo.id}: ${(error as Error).message}`),
      );
  }

  console.log(cerrados === 0 ? 'No habia turnos abiertos.' : `Turnos cerrados: ${cerrados}`);
};

// --- Orquestacion ---

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(AYUDA);
    return;
  }

  const opciones = parsearOpciones(argv, process.env);
  const ctx: Contexto = {
    cliente: crearCliente({ apiUrl: opciones.apiUrl, timeoutMs: opciones.timeoutMs }),
    opciones,
    rng: crearRng(opciones.semilla),
  };
  contexto = ctx;

  console.log(
    `Simulador -> ${opciones.apiUrl}` +
      (opciones.semilla === null ? '' : ` | semilla ${opciones.semilla}`),
  );
  if (opciones.esperarApi) await ctx.cliente.esperarApi();

  // El seed es data pura (sin PrismaClient): importarlo no siembra nada.
  const delSeed: EmpresaSemilla[] = COMPANIES;
  const todas = filtrarEmpresas(delSeed, opciones.empresas);
  if (todas.length === 0) {
    throw new Error(
      `Ninguna empresa del seed coincide con COMPANIES=${opciones.empresas.join(',')}`,
    );
  }

  // A partir de aca el simulador SOLO conoce sus choferes. Los de las personas no
  // estan en la lista, asi que ninguna rama -- ni el armado, ni la adopcion de
  // turnos activos, ni --cleanup -- puede tocarlos aunque quiera.
  const empresas = reservarChoferes(todas);
  const reservados = choferesDePersonas(todas);
  if (reservados.length > 0) {
    console.log(
      `Reservados para personas (el simulador NO los usa): ${reservados.join(', ')}`,
    );
  }

  if (opciones.limpiar) {
    console.log(
      'Limpieza manual: se cierran los turnos abiertos de los choferes DEL SIMULADOR ' +
        `(chofer1..${CHOFERES_DEL_SIMULADOR} de cada empresa). Los turnos de personas no se tocan.`,
    );
    await limpiar(ctx, empresas);
    return;
  }

  const asignaciones = repartirPorEmpresa(empresas, opciones.buses);
  console.log(
    `Empresas: ${empresas.map((empresa) => empresa.slug).join(', ')} | ` +
      `${asignaciones.length} micros pedidas de ${opciones.buses}`,
  );

  // Armado con reintentos: si el API esta caido o el cupo de login agotado, se
  // espera y se vuelve a intentar. Antes esto lanzaba, el proceso moria y ECS
  // relanzaba la tarea -- que es justo lo que hay que evitar.
  let intento = 0;
  while (micros.length === 0 && !cerrando) {
    if (intento > 0) {
      const espera = Math.min(REINTENTO_FLOTA_MIN_MS * 2 ** (intento - 1), REINTENTO_FLOTA_MAX_MS);
      console.warn(
        `Ningun chofer pudo entrar (intento ${intento}). Reintento en ${humanizarMs(espera)}. ` +
          'Revisa que el seed corrio y que el API contesta.',
      );
      await esperarApiVivo(ctx);
      await sleep(espera);
    }
    intento += 1;
    await armarFlota(ctx, asignaciones);
  }
  if (cerrando) return;

  aplicarSenales(ctx);
  resumirFlota();
  arrancarPendientes(ctx);

  /**
   * El simulador es un SERVICIO: main no termina nunca.
   *
   * Cuando terminaba, ECS veia el contenedor salir y relanzaba la tarea, y cada
   * relanzada gastaba otros 30 logins del rate limit. La unica salida es una
   * senal (SIGINT/SIGTERM), que pasa por apagar() y cierra los turnos.
   */
  let desdeUltimaRenovacion = 0;
  while (!cerrando) {
    await sleep(LATIDO_MS);
    if (cerrando) return;

    latir();

    // Arranque incremental: los choferes que no pudieron entrar se reintentan
    // aca, con la flota ya rodando. Salir con 12 micros y completar las 24 en la
    // proxima vuelta es mucho mejor que esperar a tenerlas todas para mostrar
    // algo -- y era imposible antes, porque un login fallido mataba el proceso.
    if (pendientesDeEntrar.length > 0) {
      const reintentar = pendientesDeEntrar.splice(0, pendientesDeEntrar.length);
      console.log(`Reintentando ${reintentar.length} choferes que no habian entrado.`);
      await armarFlota(ctx, reintentar);
      arrancarPendientes(ctx);
    }

    desdeUltimaRenovacion += LATIDO_MS;
    if (desdeUltimaRenovacion >= RENOVAR_CORTE_MS) {
      desdeUltimaRenovacion = 0;
      renovarSenales(ctx);
    }
  }
};

/** Ctrl+C: cerrar los turnos abiertos o quedan micros fantasma IN_TRANSIT. */
const apagar = async (): Promise<void> => {
  const abiertos = (): Micro[] => micros.filter((micro) => micro.tripId !== null);

  if (cerrando) {
    // pnpm y tsx reenvian la senal al hijo: el mismo Ctrl+C llega dos veces en
    // el mismo instante y eso no es el usuario pidiendo salida forzada.
    if (Date.now() - cerrandoDesde < REPETICION_SENAL_MS) return;

    // Segundo Ctrl+C: el usuario ya espero, se sale diciendo que queda abierto.
    const pendientes = abiertos();
    console.warn(
      pendientes.length === 0
        ? '\nSalida forzada. No quedaban turnos abiertos.'
        : `\nSalida forzada con ${pendientes.length} turnos abiertos:\n` +
            pendientes.map((micro) => `  ${micro.etiqueta} ${micro.email}`).join('\n') +
            '\nCierralos con: pnpm --filter @equipo17/api simulate -- --cleanup',
    );
    process.exit(1);
  }

  cerrando = true;
  cerrandoDesde = Date.now();
  const ctx = contexto;
  console.log(`\nCerrando ${abiertos().length} turnos... (Ctrl+C otra vez para forzar)`);

  if (ctx) {
    await Promise.race([
      Promise.allSettled(micros.map((micro) => finalizarTurno(ctx, micro))),
      sleep(CIERRE_TIMEOUT_MS),
    ]);
  }

  const pendientes = abiertos();
  if (pendientes.length > 0) {
    console.warn(
      `Quedaron ${pendientes.length} turnos abiertos. Cierralos con: ` +
        'pnpm --filter @equipo17/api simulate -- --cleanup',
    );
    process.exit(1);
  }

  console.log('Listo.');
  // process.exitCode ya viene en 1 si se llego aca por un fallo: salir con 0
  // fijo era lo que hacia que un arranque fallido se viera en ECS como una
  // salida limpia ("EssentialContainerExited", exitCode 0) en vez de un error.
  process.exit(process.exitCode === undefined ? 0 : Number(process.exitCode));
};

process.on('SIGINT', () => void apagar());
process.on('SIGTERM', () => void apagar());

/**
 * Ningun fallo suelto puede matar al proceso.
 *
 * Un servicio que corre dias se topa con un socket cortado en un momento raro,
 * un JSON a medias o un await sin catch que se coló. Cualquiera de esos tumbaba
 * el proceso entero y ECS relanzaba la tarea; con 40 micros haciendo login en
 * cada arranque, el reinicio agota el rate limit de /api/auth y entra en bucle.
 * Se registra y se sigue: una micro rota es mejor que un mapa vacio.
 */
process.on('unhandledRejection', (razon: unknown) => {
  console.error(
    'Rechazo sin capturar (el simulador sigue):',
    razon instanceof Error ? (razon.stack ?? razon.message) : razon,
  );
});

process.on('uncaughtException', (error: Error) => {
  console.error('Excepcion sin capturar (el simulador sigue):', error.stack ?? error.message);
});

main().catch(async (error: unknown) => {
  // Solo se llega aca por algo de verdad irrecuperable: la configuracion no
  // nombra ninguna empresa del seed. Los fallos de red y de rate limit se
  // reintentan dentro de main y no terminan el proceso.
  console.error('Fallo irrecuperable:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
  await apagar();
});
