import { describe, expect, it } from 'vitest';
import { encodePolyline } from '../../src/lib/polyline.js';
import {
  PARADA_MIN_MS,
  VELOCIDAD_INTERURBANA_KMH,
  VELOCIDAD_RURAL_KMH,
  VELOCIDAD_URBANA_KMH,
  avanzar,
  construirTrazado,
  estadoInicial,
  largosDeTramos,
  mezclarAngulo,
  normalizarAngulo,
  rumboEntre,
  trazadoDeParaderos,
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
  trazado: trazadoDeParaderos(stops),
  estado: estadoInicial(trazadoDeParaderos(stops), { tramo: 0, avance: 0 }),
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

describe('construirTrazado', () => {
  /**
   * Un camino en "U": los dos paraderos estan sobre el mismo paralelo, pero el
   * camino baja al sur antes de llegar. Es el caso que separa "va por la calle"
   * de "cruza en diagonal": la recta entre paraderos NUNCA baja de -33.60.
   */
  const paraderos: Punto[] = [
    { lat: -33.6, lng: -70.9 },
    { lat: -33.6, lng: -70.8 },
  ];
  const camino: Punto[] = [
    { lat: -33.6, lng: -70.9 },
    { lat: -33.65, lng: -70.9 },
    { lat: -33.65, lng: -70.8 },
    { lat: -33.6, lng: -70.8 },
  ];

  it('sin polilinea avanza entre paraderos, como siempre', () => {
    const trazado = construirTrazado(paraderos, null);

    expect(trazado.porCalles).toBe(false);
    expect(trazado.puntos).toEqual(paraderos);
    // Todos los tramos terminan en paradero: no hay nada que no lo sea.
    expect(trazado.alParadero.every((metros) => metros === 0)).toBe(true);
  });

  it('con polilinea avanza por los vertices del camino', () => {
    const trazado = construirTrazado(paraderos, encodePolyline(camino));

    expect(trazado.porCalles).toBe(true);
    expect(trazado.puntos).toHaveLength(4);
  });

  it('los vertices intermedios NO son paradero', () => {
    const trazado = construirTrazado(paraderos, encodePolyline(camino));

    // Solo el ultimo tramo termina en paradero (el terminal); los dos primeros
    // terminan en una curva y por eso les falta camino para llegar a uno.
    expect(trazado.alParadero[0]).toBeGreaterThan(0);
    expect(trazado.alParadero[1]).toBeGreaterThan(0);
    expect(trazado.alParadero[2]).toBe(0);
  });

  it('engancha cada paradero intermedio a su vertice del camino', () => {
    // El paradero del medio esta a metros de la esquina del camino.
    const conMedio = [paraderos[0]!, { lat: -33.6501, lng: -70.8002 }, paraderos[1]!];
    const trazado = construirTrazado(conMedio, encodePolyline(camino));

    // El tramo 1 (vertice 1 -> vertice 2) ahora SI termina en paradero.
    expect(trazado.alParadero[1]).toBe(0);
    expect(trazado.alParadero[0]).toBeGreaterThan(0);
  });

  it('una polilinea corrupta o vieja cae a los paraderos en vez de romper', () => {
    // Ninguna micro puede quedarse fuera del mapa por un dato de conveniencia.
    for (const mala of ['', 'no soy una polilinea', 'abc']) {
      const trazado = construirTrazado(paraderos, mala);
      expect(trazado.porCalles).toBe(false);
      expect(trazado.puntos).toEqual(paraderos);
    }
  });
});

describe('avanzar sobre el camino real', () => {
  const paraderos: Punto[] = [
    { lat: -33.6, lng: -70.9 },
    { lat: -33.6, lng: -70.8 },
  ];
  const camino: Punto[] = [
    { lat: -33.6, lng: -70.9 },
    { lat: -33.65, lng: -70.9 },
    { lat: -33.65, lng: -70.8 },
    { lat: -33.6, lng: -70.8 },
  ];
  const trazado = construirTrazado(paraderos, encodePolyline(camino));

  /** Corre la micro hasta el final y devuelve todo lo que fue emitiendo. */
  const recorrer = (sorteoParada = 0.99) => {
    let estado = estadoInicial(trazado, { tramo: 0, avance: 0 });
    const emitido: { punto: Punto; speedKmh: number; detenida: boolean }[] = [];

    for (let tick = 0; tick < 400; tick += 1) {
      const salida = avanzar({
        trazado,
        estado,
        velocidadKmh: 60,
        deltaMs: 4_000,
        ahora: 1_000_000 + tick * 4_000,
        ruido: 0.5,
        sorteoParada,
        duracionParadaMs: PARADA_MIN_MS,
      });
      estado = salida.estado;
      emitido.push({
        punto: estado.punto,
        speedKmh: salida.speedKmh,
        detenida: estado.detenidoHasta > 0,
      });
      if (salida.fin) break;
    }

    return emitido;
  };

  it('sigue el camino en vez de cruzar en diagonal', () => {
    const emitido = recorrer();

    // La recta entre paraderos se queda en -33.60; el camino baja a -33.65.
    expect(Math.min(...emitido.map((paso) => paso.punto.lat))).toBeLessThan(-33.64);
    expect(emitido[emitido.length - 1]?.punto.lng).toBeCloseTo(-70.8, 3);
  });

  it('no se detiene en las curvas del camino, solo en los paraderos', () => {
    // sorteoParada 0 = "detente en cada paradero que cruces". Entre estos dos
    // paraderos hay dos esquinas, y en ninguna puede parar.
    expect(recorrer(0).some((paso) => paso.detenida)).toBe(false);
  });

  it('no frena en cada vertice: mantiene el crucero entre paraderos', () => {
    // El sintoma de medir el frenado contra el proximo vertice y no contra el
    // proximo paradero es una micro que cruza todo el recorrido al 28%.
    const enMarcha = recorrer().slice(0, -3);
    const maxima = Math.max(...enMarcha.map((paso) => paso.speedKmh));

    expect(maxima).toBeGreaterThan(55);
  });

  it('frena al acercarse al paradero final', () => {
    const emitido = recorrer();
    const ultima = emitido[emitido.length - 1]?.speedKmh ?? 0;

    expect(ultima).toBeLessThan(60 * 0.5);
    expect(ultima).toBeGreaterThan(0);
  });

  it('el rumbo sigue las curvas del camino', () => {
    const rumbos = new Set<number>();
    let estado = estadoInicial(trazado, { tramo: 0, avance: 0 });

    for (let tick = 0; tick < 400; tick += 1) {
      const salida = avanzar({
        trazado,
        estado,
        velocidadKmh: 60,
        deltaMs: 4_000,
        ahora: 1_000_000 + tick * 4_000,
        ruido: 0.5,
        sorteoParada: 0.99,
        duracionParadaMs: PARADA_MIN_MS,
      });
      estado = salida.estado;
      rumbos.add(Math.round(estado.heading / 45));
      if (salida.fin) break;
    }

    // Sur, este y norte: sobre la recta el rumbo habria sido siempre el mismo.
    expect(rumbos.size).toBeGreaterThanOrEqual(3);
  });
});

describe('avanzar sobre un camino denso', () => {
  /**
   * Lo que devuelve de verdad la Routes API con polylineQuality HIGH_QUALITY:
   * vertices cada pocas decenas de metros, muy por debajo del radio de frenado.
   * Aca es donde se nota si el frenado se mide contra el proximo VERTICE (la
   * micro cruzaria los 10 km al 28% de la velocidad) o contra el proximo
   * PARADERO, que es lo correcto.
   */
  const paraderos: Punto[] = [
    { lat: -33.6, lng: -70.9 },
    { lat: -33.51, lng: -70.9 },
  ];
  const denso: Punto[] = Array.from({ length: 201 }, (_, i) => ({
    lat: -33.6 + (0.09 * i) / 200,
    lng: -70.9,
  }));

  it('los vertices quedan por debajo del radio de frenado', () => {
    const largos = largosDeTramos(denso);
    expect(Math.max(...largos)).toBeLessThan(100);
  });

  it('cruza a velocidad de crucero y solo frena cerca del paradero', () => {
    const trazado = construirTrazado(paraderos, encodePolyline(denso));
    let estado = estadoInicial(trazado, { tramo: 0, avance: 0 });
    const velocidades: number[] = [];

    for (let tick = 0; tick < 400; tick += 1) {
      const salida = avanzar({
        trazado,
        estado,
        velocidadKmh: 60,
        deltaMs: 4_000,
        ahora: 1_000_000 + tick * 4_000,
        ruido: 0.5,
        sorteoParada: 0.99,
        duracionParadaMs: PARADA_MIN_MS,
      });
      estado = salida.estado;
      velocidades.push(salida.speedKmh);
      if (salida.fin) break;
    }

    // A mitad de camino, lejos de todo paradero, va a crucero.
    expect(velocidades[Math.floor(velocidades.length / 2)]).toBeGreaterThan(55);
    // Y al final si frena.
    expect(velocidades[velocidades.length - 1]).toBeLessThan(30);
  });
});
