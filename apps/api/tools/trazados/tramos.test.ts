import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline } from '../../src/lib/polyline.js';
import {
  MAXIMO_INTERMEDIOS,
  PUNTOS_POR_PETICION,
  largoDelCamino,
  partirEnTramos,
  rodeoInverosimil,
  unirPolilineas,
} from './tramos.js';

describe('partirEnTramos', () => {
  it('un recorrido corto cabe en una sola peticion', () => {
    expect(partirEnTramos(8)).toEqual([{ inicio: 0, fin: 7 }]);
  });

  it('justo en el limite sigue siendo una peticion', () => {
    expect(partirEnTramos(PUNTOS_POR_PETICION)).toHaveLength(1);
    expect(partirEnTramos(PUNTOS_POR_PETICION + 1)).toHaveLength(2);
  });

  it('parte los 61 paraderos de MuniBus y los tramos comparten el borde', () => {
    const tramos = partirEnTramos(61);

    expect(tramos).toEqual([
      { inicio: 0, fin: 26 },
      { inicio: 26, fin: 52 },
      { inicio: 52, fin: 60 },
    ]);
  });

  it('ningun tramo pide mas intermedios de los que acepta la API', () => {
    for (const cantidad of [2, 3, 27, 28, 40, 61, 200]) {
      for (const tramo of partirEnTramos(cantidad)) {
        const intermedios = tramo.fin - tramo.inicio - 1;
        expect(intermedios).toBeLessThanOrEqual(MAXIMO_INTERMEDIOS);
      }
    }
  });

  it('los tramos cubren el recorrido entero sin huecos', () => {
    for (const cantidad of [2, 27, 28, 61, 137]) {
      const tramos = partirEnTramos(cantidad);
      expect(tramos[0]?.inicio).toBe(0);
      expect(tramos[tramos.length - 1]?.fin).toBe(cantidad - 1);
      // El fin de cada tramo es el inicio del siguiente: es lo que evita el
      // salto en recta al pegar las polilineas.
      for (let i = 1; i < tramos.length; i += 1) {
        expect(tramos[i]?.inicio).toBe(tramos[i - 1]?.fin);
      }
    }
  });

  it('un recorrido de un solo paradero no pide nada', () => {
    expect(partirEnTramos(1)).toEqual([]);
    expect(partirEnTramos(0)).toEqual([]);
  });
});

describe('unirPolilineas', () => {
  const tramoA = [
    { lat: -33.6182, lng: -70.90739 },
    { lat: -33.61, lng: -70.89 },
    { lat: -33.60586, lng: -70.87853 },
  ];
  // Arranca donde termino el anterior: comparten paradero.
  const tramoB = [
    { lat: -33.60586, lng: -70.87853 },
    { lat: -33.59, lng: -70.84 },
    { lat: -33.56731, lng: -70.80205 },
  ];

  it('pega los tramos sin repetir el punto que comparten', () => {
    const unida = decodePolyline(unirPolilineas([tramoA, tramoB].map(encodePolyline)));

    expect(unida).toHaveLength(5);
    expect(unida[0]?.lat).toBeCloseTo(-33.6182, 5);
    expect(unida[4]?.lat).toBeCloseTo(-33.56731, 5);
    // El paradero compartido aparece UNA vez: repetido dejaria un tramo de
    // largo 0 y el simulador dividiria por cero al avanzar.
    expect(unida.filter((punto) => Math.abs(punto.lat + 33.60586) < 1e-6)).toHaveLength(1);
  });

  it('un solo tramo pasa entero', () => {
    expect(decodePolyline(unirPolilineas([encodePolyline(tramoA)]))).toHaveLength(3);
  });

  it('sin tramos no hay trazado', () => {
    expect(unirPolilineas([])).toBe('');
  });
});

describe('rodeoInverosimil', () => {
  it('un recorrido normal (1,4x la recta) se acepta', () => {
    expect(rodeoInverosimil(50_000, 36_000)).toBeNull();
  });

  it('un rodeo de 6x sobre decenas de km se rechaza y dice por que', () => {
    // El caso de los dos lados de un rio sin puente: la API no da error, da un
    // camino larguisimo por el puente de mas abajo.
    const motivo = rodeoInverosimil(120_000, 20_000);

    expect(motivo).toContain('6.0x');
    expect(motivo).toContain('no hay camino directo');
  });

  it('sobre pocos metros un rodeo grande no significa nada', () => {
    // Dos paraderos enfrentados en una calle de un solo sentido dan 4x sin que
    // haya ningun problema.
    expect(rodeoInverosimil(800, 200)).toBeNull();
  });
});

describe('largoDelCamino', () => {
  it('suma los tramos y no la recta entre extremos', () => {
    // Ida y vuelta sobre el mismo meridiano: la recta entre extremos es 0, el
    // camino recorrido no.
    const ida = { lat: -33.5, lng: -70.8 };
    const vuelta = { lat: -33.6, lng: -70.8 };

    expect(largoDelCamino([ida, vuelta, ida])).toBeGreaterThan(20_000);
  });

  it('un solo punto no tiene largo', () => {
    expect(largoDelCamino([{ lat: -33.5, lng: -70.8 }])).toBe(0);
  });
});
