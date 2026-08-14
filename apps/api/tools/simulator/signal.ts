/**
 * Perfiles de senal de las micros simuladas.
 *
 * El calculo que define este archivo: con un ping cada DRIVER_PING_INTERVAL_MS
 * (4 s) y el umbral LIVE en FRESHNESS_LIVE_MS (30 s), hacen falta OCHO pings
 * perdidos seguidos para que la interfaz muestre "Senal intermitente". Con
 * perdida independiente al 55% eso pasa el 0,8% de los ticks: frente a un jurado
 * es inservible, porque el estado degradado no aparece nunca cuando se lo mira.
 *
 * Por eso INTERMITENTE no es solo perdida al azar: es perdida base MAS apagones
 * de 35-70 s cada 90-180 s. El apagon garantiza el ciclo completo
 * En vivo -> Senal intermitente -> (a veces) Sin senal -> En vivo, repetido y
 * visible, y la perdida base evita que se vea como un metronomo.
 */
import { entre } from './rng.js';
import type { Rng } from './rng.js';

export type PerfilSenal = 'BUENA' | 'INTERMITENTE' | 'CORTE';

/** Lo unico que el simulador le pregunta a la senal: ¿mando este tick? */
export type Senal = { transmite: (ahora: number) => boolean };

/** Probabilidad de perder un ping suelto estando "con senal". */
const PERDIDA_BASE = 0.4;

const APAGON_MIN_MS = 35_000;
const APAGON_MAX_MS = 70_000;
const ENTRE_APAGONES_MIN_MS = 90_000;
const ENTRE_APAGONES_MAX_MS = 180_000;

/** Antes del primer apagon se deja ver un rato de "En vivo" limpio. */
const PRIMER_APAGON_MIN_MS = 25_000;
const PRIMER_APAGON_MAX_MS = 60_000;

/** A los ~45 s la micro del perfil CORTE enmudece, sin cerrar el turno. */
const CORTE_MIN_MS = 40_000;
const CORTE_MAX_MS = 55_000;

const senalSiempre: Senal = { transmite: () => true };

/**
 * Deja de transmitir y NO cierra el turno: la micro no desaparece del mapa, se
 * pone vieja. Mostrar el envejecimiento es justamente lo que promete el sistema.
 */
const senalDeCorte = (rng: Rng, inicio: number): Senal => {
  const enmudeceEn = inicio + entre(rng, CORTE_MIN_MS, CORTE_MAX_MS);
  return { transmite: (ahora) => ahora < enmudeceEn };
};

const senalIntermitente = (rng: Rng, inicio: number): Senal => {
  let proximoApagon = inicio + entre(rng, PRIMER_APAGON_MIN_MS, PRIMER_APAGON_MAX_MS);
  let finApagon = 0;

  return {
    transmite: (ahora) => {
      if (ahora < finApagon) return false;
      if (ahora >= proximoApagon) {
        finApagon = ahora + entre(rng, APAGON_MIN_MS, APAGON_MAX_MS);
        proximoApagon = finApagon + entre(rng, ENTRE_APAGONES_MIN_MS, ENTRE_APAGONES_MAX_MS);
        return false;
      }
      return rng() >= PERDIDA_BASE;
    },
  };
};

export const crearSenal = (perfil: PerfilSenal, rng: Rng, inicio: number): Senal => {
  if (perfil === 'BUENA') return senalSiempre;
  if (perfil === 'CORTE') return senalDeCorte(rng, inicio);
  return senalIntermitente(rng, inicio);
};

// --- Reparto de perfiles sobre la flota ---

export type PlanSenal = {
  perfil: PerfilSenal;
  /**
   * Indice de la micro sana con la que comparte corredor. El orquestador copia
   * su recorrido: la comparacion lado a lado (una en vivo, otra envejeciendo) es
   * lo que hace legible la frescura. null cuando el perfil es BUENA.
   */
  espejo: number | null;
};

export type OpcionesPlan = {
  todoBueno: boolean;
  forzarCorte: boolean;
  forzarIntermitente: boolean;
};

/** Sobre 18 micros: 6 degradadas (4 intermitentes + 2 cortes) y 12 sanas. */
const PROPORCION_DEGRADADAS = 1 / 3;
const PROPORCION_CORTES = 1 / 3;

/**
 * Decide que micro lleva que perfil.
 *
 * Dos reglas, y ninguna es estetica:
 *  1. Maximo UNA micro degradada por empresa. Si las tres de Paine se caen, el
 *     jurado concluye que la app anda mal con Paine, no que el sistema detecta
 *     senal mala.
 *  2. Toda micro degradada comparte corredor con una sana. Sin el par sano al
 *     lado, "Sin senal" se lee como una falla de la app.
 *
 * De ahi que solo se degrade la ultima micro de una empresa que tenga al menos
 * dos: la primera queda sana y es el espejo.
 */
export const planificarSenales = (
  empresaPorMicro: string[],
  opciones: OpcionesPlan = { todoBueno: false, forzarCorte: false, forzarIntermitente: false },
): PlanSenal[] => {
  const plan: PlanSenal[] = empresaPorMicro.map(() => ({ perfil: 'BUENA', espejo: null }));
  if (opciones.todoBueno || empresaPorMicro.length < 2) return plan;

  // Por empresa: la primera micro es el espejo sano, la ultima es la candidata.
  const porEmpresa = new Map<string, number[]>();
  empresaPorMicro.forEach((slug, indice) => {
    const previas = porEmpresa.get(slug) ?? [];
    previas.push(indice);
    porEmpresa.set(slug, previas);
  });

  const candidatas: { micro: number; espejo: number }[] = [];
  for (const indices of porEmpresa.values()) {
    const espejo = indices[0];
    const micro = indices[indices.length - 1];
    if (espejo === undefined || micro === undefined || micro === espejo) continue;
    candidatas.push({ micro, espejo });
  }

  // Flota demasiado chica para cumplir la regla 2 (una micro por empresa): con
  // --drop-signal / --flaky igual hay que mostrar el estado, asi que se degrada
  // la ultima sin espejo. Es explicito y no silencioso.
  if (candidatas.length === 0) {
    if (!opciones.forzarCorte && !opciones.forzarIntermitente) return plan;
    const ultima = empresaPorMicro.length - 1;
    const entrada = plan[ultima];
    if (entrada) entrada.perfil = opciones.forzarIntermitente ? 'INTERMITENTE' : 'CORTE';
    return plan;
  }

  const objetivo = Math.max(1, Math.round(empresaPorMicro.length * PROPORCION_DEGRADADAS));
  const degradadas = Math.min(candidatas.length, objetivo);
  const cortes = Math.max(1, Math.round(degradadas * PROPORCION_CORTES));

  candidatas.slice(0, degradadas).forEach(({ micro, espejo }, orden) => {
    const entrada = plan[micro];
    if (!entrada) return;
    entrada.perfil = orden < cortes ? 'CORTE' : 'INTERMITENTE';
    entrada.espejo = espejo;
  });

  // Los flags solo garantizan que el estado pedido exista; no cambian el reparto.
  const hay = (perfil: PerfilSenal): boolean => plan.some((entrada) => entrada.perfil === perfil);
  const forzar = (perfil: PerfilSenal): void => {
    const libre = candidatas.find(({ micro }) => plan[micro]?.perfil === 'BUENA') ?? candidatas[0];
    const entrada = libre ? plan[libre.micro] : undefined;
    if (!libre || !entrada) return;
    entrada.perfil = perfil;
    entrada.espejo = libre.espejo;
  };
  if (opciones.forzarCorte && !hay('CORTE')) forzar('CORTE');
  if (opciones.forzarIntermitente && !hay('INTERMITENTE')) forzar('INTERMITENTE');

  return plan;
};
