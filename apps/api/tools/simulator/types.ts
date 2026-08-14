import type { PerfilSenal, Senal } from './signal.js';

export type Punto = { lat: number; lng: number };

export type Paradero = Punto & { id: string; name: string; stopOrder: number };

export type RutaResumen = {
  id: string;
  code: string;
  name: string;
  originName: string;
  destinationName: string;
};

export type RutaDetalle = RutaResumen & { stops: Paradero[] };

/**
 * Lo que el simulador necesita del seed. Se declara estructuralmente y no se
 * importa el tipo de prisma/seed/data para que un campo nuevo alla no obligue a
 * tocar esto: alcanza con que siga habiendo slug, nombre y choferes.
 */
export type EmpresaSemilla = {
  slug: string;
  name: string;
  drivers: { email: string; name: string }[];
};

/** Una micro pedida: que chofer de que empresa, y cuantas lleva esa empresa. */
export type Asignacion = {
  empresaSlug: string;
  empresaNombre: string;
  email: string;
  nombre: string;
  /** 0-based: sirve para repartir los recorridos dentro de la empresa. */
  ordinal: number;
};

/** Estado cinematico de una micro. Lo produce y consume motion.ts. */
export type EstadoMovimiento = {
  /** Indice del paradero desde el que va saliendo. */
  tramo: number;
  /** Avance dentro del tramo, 0..1. Es lo que hace suave el movimiento. */
  avance: number;
  heading: number;
  /** Epoch ms hasta el que esta detenida en un paradero. 0 = en marcha. */
  detenidoHasta: number;
  punto: Punto;
};

/** El payload que acepta positionInputSchema. */
export type Muestra = {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: number;
};

export type Micro = {
  /** Posicion en la flota: define su punto de arranque disperso. */
  indice: number;
  etiqueta: string;
  empresaSlug: string;
  empresaNombre: string;
  email: string;
  token: string;
  ruta: RutaDetalle;
  /** Recorridos de la empresa: de ahi sale el sentido contrario al dar la vuelta. */
  rutasDeEmpresa: RutaResumen[];
  tripId: string | null;
  perfil: PerfilSenal;
  senal: Senal;
  /** Variacion de velocidad propia, fijada UNA vez al armar la flota. */
  variacion: number;
  velocidadKmh: number;
  estado: EstadoMovimiento;
  /** Posiciones acumuladas sin senal. Se vacian en un solo POST al recuperarla. */
  backlog: Muestra[];
  /** Fallos de red seguidos. Solo informativo: la micro nunca se da de baja. */
  fallos: number;
  terminada: boolean;
};

export type Opciones = {
  apiUrl: string;
  password: string | null;
  buses: number;
  /** Slugs a incluir. Vacio = todas las del seed. */
  empresas: string[];
  semilla: number | null;
  esperarApi: boolean;
  unaVuelta: boolean;
  limpiar: boolean;
  forzarCorte: boolean;
  forzarIntermitente: boolean;
  todoBueno: boolean;
  staggerMs: number;
  timeoutMs: number;
};
