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
const CIERRE_TIMEOUT_MS = 5_000;

/** Ventana en la que una segunda senal se considera un reenvio, no un segundo Ctrl+C. */
const REPETICION_SENAL_MS = 800;

const etiquetaDe = (empresa: string, codigo: string): string => `[${empresa} ${codigo}]`;

const micros: Micro[] = [];
const detalles = new Map<string, RutaDetalle>();
let contexto: Contexto | null = null;
let cerrando = false;
let cerrandoDesde = 0;

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

/** Un 429 aca no se reintenta: se corta con algo que el equipo pueda hacer. */
const explicarRateLimit = (error: ApiError): Error =>
  new Error(
    `El API corto los logins (429). Espera ${error.resetSegundos ?? 900} s, o levanta ` +
      'AUTH_RATE_LIMIT en apps/api/src/routes/auth.routes.ts. Reintentar ahora solo gasta mas cupo.',
  );

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
    .catch((error: unknown) => {
      console.warn(`${micro.etiqueta} no pudo iniciar turno: ${(error as Error).message}`);
      return null;
    });

  if (!creado) {
    micro.terminada = true;
    return;
  }
  micro.tripId = creado.trip.id;
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
  const ubicacion = ubicarPorMetros(micro.ruta.stops, fraccionDispersion(micro.indice));
  micro.estado = estadoInicial(micro.ruta.stops, ubicacion);
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
      // Un ping perdido es normal en terreno: se reintenta en el siguiente tick.
      micro.fallos += 1;
      console.warn(`${micro.etiqueta} ping fallido (${micro.fallos}):`, (error as Error).message);
      micro.backlog = lote.slice(-MAX_BACKLOG);
    });
};

const invertirRuta = (ruta: RutaDetalle): RutaDetalle => ({
  ...ruta,
  originName: ruta.destinationName,
  destinationName: ruta.originName,
  stops: [...ruta.stops].reverse(),
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
  micro.estado = estadoInicial(micro.ruta.stops, { tramo: 0, avance: 0 });
  micro.estado.detenidoHasta = Date.now() + enteroEntre(ctx.rng, DESCANSO_MIN_MS, DESCANSO_MAX_MS);
  micro.velocidadKmh = velocidadCruceroKmh(micro.ruta.stops) * micro.variacion;
};

const tick = async (ctx: Contexto, micro: Micro): Promise<void> => {
  // Un tick en vuelo despues del cierre postearia a un turno COMPLETED y
  // recibiria un 409 que no significa nada.
  if (cerrando || !micro.tripId) return;

  const ahora = Date.now();
  const salida = avanzar({
    stops: micro.ruta.stops,
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
 * Bucle propio por micro: una excepcion en una micro no puede cortar la corrida
 * completa, y el desfase reparte las conexiones dentro del intervalo de ping.
 */
const correr = async (ctx: Contexto, micro: Micro, desfaseMs: number): Promise<void> => {
  await sleep(desfaseMs);

  while (!cerrando && !micro.terminada) {
    await tick(ctx, micro).catch((error: unknown) => {
      micro.fallos += 1;
      console.warn(`${micro.etiqueta} tick fallido (${micro.fallos}):`, (error as Error).message);
    });
    await sleep(DRIVER_PING_INTERVAL_MS);
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

const armarFlota = async (ctx: Contexto, asignaciones: Asignacion[]): Promise<void> => {
  const password = ctx.opciones.password ?? DEMO_PASSWORD;
  const rutasPorEmpresa = new Map<string, RutaResumen[]>();
  const usadas = new Set<string>();

  for (const [indice, asignacion] of asignaciones.entries()) {
    // Login escalonado y secuencial: veinte bcrypt concurrentes clavan el event
    // loop del API justo cuando el jurado esta mirando el mapa.
    if (indice > 0) await sleep(ctx.opciones.staggerMs);

    const token = await ctx.cliente.login(asignacion.email, password).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 429) throw explicarRateLimit(error);
      console.warn(`${asignacion.email} no pudo entrar: ${(error as Error).message}`);
      return null;
    });
    if (!token) continue;

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
    const micro: Micro = {
      indice: indiceMicro,
      etiqueta: etiquetaDe(asignacion.empresaNombre, ruta.code),
      empresaSlug: asignacion.empresaSlug,
      empresaNombre: asignacion.empresaNombre,
      email: asignacion.email,
      token,
      ruta,
      rutasDeEmpresa: rutas,
      tripId: activo?.id ?? null,
      perfil: 'BUENA',
      senal: crearSenal('BUENA', ctx.rng, Date.now()),
      variacion,
      velocidadKmh: velocidadCruceroKmh(ruta.stops) * variacion,
      estado: estadoInicial(
        ruta.stops,
        ubicarPorMetros(ruta.stops, fraccionDispersion(indiceMicro)),
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

/** Aplica el plan de senales y empareja cada micro degradada con su espejo sano. */
const aplicarSenales = (ctx: Contexto): void => {
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

const resumirFlota = (): void => {
  for (const micro of micros) {
    const km = (largoTotalM(micro.ruta.stops) / 1000).toFixed(1);
    console.log(
      `  ${micro.etiqueta} ${micro.email} ${micro.ruta.name} | ${km} km | ` +
        `${Math.round(micro.velocidadKmh)} km/h | senal ${micro.perfil}`,
    );
  }
  const porPerfil = micros.reduce<Record<string, number>>((cuenta, micro) => {
    cuenta[micro.perfil] = (cuenta[micro.perfil] ?? 0) + 1;
    return cuenta;
  }, {});
  const empresas = new Set(micros.map((micro) => micro.empresaSlug));
  console.log(
    `Micros: ${micros.length} en ${empresas.size} empresas | ` +
      Object.entries(porPerfil)
        .map(([perfil, cuantas]) => `${perfil}: ${cuantas}`)
        .join(' | '),
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
  const empresas = filtrarEmpresas(delSeed, opciones.empresas);
  if (empresas.length === 0) {
    throw new Error(
      `Ninguna empresa del seed coincide con COMPANIES=${opciones.empresas.join(',')}`,
    );
  }

  if (opciones.limpiar) {
    await limpiar(ctx, empresas);
    return;
  }

  const asignaciones = repartirPorEmpresa(empresas, opciones.buses);
  console.log(
    `Empresas: ${empresas.map((empresa) => empresa.slug).join(', ')} | ` +
      `${asignaciones.length} micros pedidas de ${opciones.buses}`,
  );

  await armarFlota(ctx, asignaciones);
  if (micros.length === 0) {
    throw new Error(
      'Ningun chofer pudo entrar. Corre `pnpm --filter @equipo17/api seed` y revisa que el API este arriba.',
    );
  }

  aplicarSenales(ctx);
  resumirFlota();

  for (const micro of micros) {
    if (cerrando) return;
    if (!micro.tripId) await iniciarTurno(ctx, micro);
  }

  const paso = DRIVER_PING_INTERVAL_MS / micros.length;
  await Promise.all(micros.map((micro, indice) => correr(ctx, micro, Math.round(indice * paso))));

  if (!cerrando) console.log('Todas las micros terminaron su recorrido.');
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
  if (pendientes.length === 0) {
    console.log('Listo.');
    process.exit(0);
  }
  console.warn(
    `Quedaron ${pendientes.length} turnos abiertos. Cierralos con: ` +
      'pnpm --filter @equipo17/api simulate -- --cleanup',
  );
  process.exit(1);
};

process.on('SIGINT', () => void apagar());
process.on('SIGTERM', () => void apagar());

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  await apagar();
});
