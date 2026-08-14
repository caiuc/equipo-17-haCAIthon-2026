import { describe, expect, it } from 'vitest';
import {
  PARADA_MIN_MS,
  VELOCIDAD_INTERURBANA_KMH,
  VELOCIDAD_RURAL_KMH,
  VELOCIDAD_URBANA_KMH,
  avanzar,
  estadoInicial,
  largosDeTramos,
  mezclarAngulo,
  normalizarAngulo,
  rumboEntre,
  variacionDe,
  velocidadCruceroKmh,
} from './motion.js';
import type { Punto } from './types.js';

/** Sobre un meridiano: 0,01° de latitud son ~1,1 km. */
const meridiano = (grados: number[]): Punto[] =>
  grados.map((lat) => ({ lat: -33.5 - lat, lng: -70.8 }));

const rutaUrbana = meridiano([0, 0.008, 0.016, 0.024]);
const rutaRural = meridiano([0, 0.025, 0.05, 0.075]);
const rutaInterurbana = meridiano([0, 0.06, 0.12, 0.18]);

const entrada = (stops: Punto[], sobrescribe: Partial<Parameters<typeof avanzar>[0]> = {}) => ({
  stops,
  estado: estadoInicial(stops, { tramo: 0, avance: 0 }),
  velocidadKmh: 60,
  deltaMs: 4_000,
  ahora: 1_000_000,
  ruido: 0.5,
  sorteoParada: 0.99,
  duracionParadaMs: PARADA_MIN_MS,
  ...sobrescribe,
});

describe('angulos', () => {
  it('normaliza a [0, 360)', () => {
    expect(normalizarAngulo(-90)).toBe(270);
    expect(normalizarAngulo(360)).toBe(0);
    expect(normalizarAngulo(725)).toBe(5);
  });

  it('mezcla por el camino corto al cruzar el 0/360', () => {
    // De 350° a 10° son 20° a la derecha, no 340° a la izquierda.
    expect(mezclarAngulo(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(mezclarAngulo(10, 350, 0.5)).toBeCloseTo(0, 6);
    expect(mezclarAngulo(350, 10, 1)).toBeCloseTo(10, 6);
  });

  it('siempre devuelve un angulo dentro del rango que acepta el API', () => {
    for (const desde of [0, 45, 179, 180, 181, 270, 359]) {
      for (const hasta of [0, 90, 200, 359]) {
        const mezclado = mezclarAngulo(desde, hasta, 0.45);
        expect(mezclado).toBeGreaterThanOrEqual(0);
        expect(mezclado).toBeLessThan(360);
      }
    }
  });

  it('un rumbo hacia el sur es 180', () => {
    expect(rumboEntre({ lat: -33.5, lng: -70.8 }, { lat: -33.6, lng: -70.8 })).toBeCloseTo(180, 1);
  });
});

describe('velocidadCruceroKmh', () => {
  it('sale de la geometria del recorrido', () => {
    expect(velocidadCruceroKmh(rutaUrbana)).toBe(VELOCIDAD_URBANA_KMH);
    expect(velocidadCruceroKmh(rutaRural)).toBe(VELOCIDAD_RURAL_KMH);
    expect(velocidadCruceroKmh(rutaInterurbana)).toBe(VELOCIDAD_INTERURBANA_KMH);
  });

  it('la variacion por micro se queda dentro del +-15%', () => {
    expect(variacionDe(0)).toBeCloseTo(0.85, 6);
    expect(variacionDe(1)).toBeCloseTo(1.15, 6);
    expect(variacionDe(0.5)).toBeCloseTo(1, 6);
  });
});

describe('avanzar', () => {
  it('avanza sobre el tramo y deja un rumbo utilizable', () => {
    const salida = avanzar(entrada(rutaRural));

    expect(salida.fin).toBe(false);
    expect(salida.estado.avance).toBeGreaterThan(0);
    expect(salida.speedKmh).toBeGreaterThan(0);
    expect(salida.estado.punto.lat).toBeLessThan(-33.5);
    expect(salida.estado.heading).toBeCloseTo(180, 0);
  });

  it('frena al acercarse al paradero pero nunca se congela en marcha', () => {
    const largo = largosDeTramos(rutaRural)[0] ?? 1;
    const base = entrada(rutaRural);
    const cerca = avanzar({
      ...base,
      estado: { ...base.estado, avance: 1 - 50 / largo },
      deltaMs: 1,
    });

    expect(cerca.speedKmh).toBeLessThan(base.velocidadKmh * 0.5);
    expect(cerca.speedKmh).toBeGreaterThan(0);
  });

  it('al cruzar un paradero puede detenerse, y detenida conserva el rumbo', () => {
    const base = entrada(rutaRural, { sorteoParada: 0, deltaMs: 20_000 });
    const cruzando = avanzar({ ...base, estado: { ...base.estado, avance: 0.99 } });

    expect(cruzando.estado.detenidoHasta).toBeGreaterThan(base.ahora);
    expect(cruzando.speedKmh).toBe(0);

    const quieta = avanzar({ ...base, estado: cruzando.estado });
    expect(quieta.speedKmh).toBe(0);
    expect(quieta.estado.punto).toEqual(cruzando.estado.punto);
    expect(quieta.estado.heading).toBe(cruzando.estado.heading);
  });

  it('marca el fin al pisar el ultimo paradero', () => {
    const base = entrada(rutaRural, { deltaMs: 20_000 });
    const salida = avanzar({
      ...base,
      estado: { ...base.estado, tramo: rutaRural.length - 2, avance: 0.99 },
    });

    expect(salida.fin).toBe(true);
    expect(salida.estado.avance).toBe(1);
  });

  it('no se cuelga si el tick cubre varios tramos de golpe', () => {
    const salida = avanzar(entrada(rutaUrbana, { deltaMs: 600_000 }));

    expect(salida.fin).toBe(true);
  });
});
