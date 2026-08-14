import { describe, expect, it } from 'vitest';
import { haversineMeters } from '../../src/lib/geo.js';
import {
  buscarRutaInversa,
  filtrarEmpresas,
  fraccionDispersion,
  largoTotalM,
  repartirPorEmpresa,
  ubicarPorMetros,
} from './fleet.js';
import type { EmpresaSemilla, Punto } from './types.js';

const empresa = (slug: string, choferes: number): EmpresaSemilla => ({
  slug,
  name: slug.toUpperCase(),
  drivers: Array.from({ length: choferes }, (_, i) => ({
    email: `chofer${i + 1}@${slug}.cl`,
    name: `Chofer ${i + 1} ${slug}`,
  })),
});

const OCHO = [
  'bupesa',
  'talagante',
  'islaval',
  'damir',
  'cobrexpress',
  'paine',
  'munibus',
  'colina',
];

/** Tramos de 1,1 km y 10 km sobre el mismo meridiano: el caso que rompe el reparto por indice. */
const rutaDesigual: Punto[] = [
  { lat: -33.6, lng: -70.9 },
  { lat: -33.61, lng: -70.9 },
  { lat: -33.7, lng: -70.9 },
];

describe('repartirPorEmpresa', () => {
  it('da una micro a cada empresa antes de darle la segunda a ninguna', () => {
    const empresas = OCHO.map((slug) => empresa(slug, 3));
    const asignaciones = repartirPorEmpresa(empresas, 8);

    expect(asignaciones).toHaveLength(8);
    expect(new Set(asignaciones.map((a) => a.empresaSlug)).size).toBe(8);
    expect(asignaciones.every((a) => a.ordinal === 0)).toBe(true);
  });

  it('con 18 micros sobre 8 empresas no concentra la flota en las primeras', () => {
    const empresas = OCHO.map((slug) => empresa(slug, 3));
    const asignaciones = repartirPorEmpresa(empresas, 18);

    const porEmpresa = new Map<string, number>();
    for (const asignacion of asignaciones) {
      porEmpresa.set(asignacion.empresaSlug, (porEmpresa.get(asignacion.empresaSlug) ?? 0) + 1);
    }

    expect(asignaciones).toHaveLength(18);
    expect(porEmpresa.size).toBe(8);
    expect(Math.max(...porEmpresa.values()) - Math.min(...porEmpresa.values())).toBeLessThanOrEqual(
      1,
    );
    // Ningun chofer repetido: dos turnos del mismo chofer serian dos puntos.
    expect(new Set(asignaciones.map((a) => a.email)).size).toBe(18);
  });

  it('saltea a la empresa que se quedo sin choferes y sigue con las demas', () => {
    const asignaciones = repartirPorEmpresa([empresa('a', 1), empresa('b', 3)], 4);

    expect(asignaciones.map((a) => a.empresaSlug)).toEqual(['a', 'b', 'b', 'b']);
  });

  it('nunca pide mas micros que las pedidas', () => {
    expect(
      repartirPorEmpresa(
        OCHO.map((slug) => empresa(slug, 3)),
        3,
      ),
    ).toHaveLength(3);
  });
});

describe('filtrarEmpresas', () => {
  const empresas = OCHO.map((slug) => empresa(slug, 2));

  it('sin filtro devuelve todas', () => {
    expect(filtrarEmpresas(empresas, [])).toHaveLength(8);
  });

  it('filtra por slug ignorando mayusculas y espacios', () => {
    expect(filtrarEmpresas(empresas, [' Paine ', 'colina']).map((e) => e.slug)).toEqual([
      'paine',
      'colina',
    ]);
  });
});

describe('ubicarPorMetros', () => {
  it('reparte por metros y no por indice de paradero', () => {
    // La mitad del recorrido en metros cae dentro del tramo largo, no en el corte
    // entre paraderos, que es donde la caeria un reparto por indice.
    const { tramo, avance } = ubicarPorMetros(rutaDesigual, 0.5);

    expect(tramo).toBe(1);
    expect(avance).toBeGreaterThan(0.4);
    expect(avance).toBeLessThan(0.5);
  });

  it('la fraccion pedida coincide con la fraccion recorrida en metros', () => {
    const total = largoTotalM(rutaDesigual);

    for (const fraccion of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const { tramo, avance } = ubicarPorMetros(rutaDesigual, fraccion);
      let recorrido = 0;
      for (let i = 0; i < tramo; i += 1) {
        const desde = rutaDesigual[i];
        const hasta = rutaDesigual[i + 1];
        if (desde && hasta) recorrido += haversineMeters(desde, hasta);
      }
      const desde = rutaDesigual[tramo];
      const hasta = rutaDesigual[tramo + 1];
      if (desde && hasta) recorrido += haversineMeters(desde, hasta) * avance;

      expect(recorrido / total).toBeCloseTo(fraccion, 2);
    }
  });

  it('la dispersion de la flota se reparte por el recorrido sin amontonarse', () => {
    const posiciones = Array.from({ length: 12 }, (_, i) => fraccionDispersion(i));

    expect(Math.min(...posiciones)).toBeGreaterThanOrEqual(0.05);
    expect(Math.max(...posiciones)).toBeLessThanOrEqual(0.9);
    // Ningun par de micros arranca practicamente en el mismo punto.
    const ordenadas = [...posiciones].sort((a, b) => a - b);
    const separaciones = ordenadas.slice(1).map((valor, i) => valor - (ordenadas[i] ?? 0));
    expect(Math.min(...separaciones)).toBeGreaterThan(0.02);
  });

  it('tolera un recorrido de un solo paradero', () => {
    expect(ubicarPorMetros([{ lat: -33, lng: -70 }], 0.5)).toEqual({ tramo: 0, avance: 0 });
  });
});

describe('buscarRutaInversa', () => {
  const ida = {
    id: 'r1',
    code: 'BUP-01',
    name: 'Ida',
    originName: 'Terminal Penaflor',
    destinationName: 'Terminal San Borja',
  };
  const vuelta = {
    id: 'r2',
    code: 'BUP-02',
    name: 'Vuelta',
    originName: 'Terminal San Borja',
    destinationName: 'Terminal Penaflor',
  };

  it('encuentra el sentido contrario publicado como recorrido propio', () => {
    expect(buscarRutaInversa(ida, [ida, vuelta])?.id).toBe('r2');
  });

  it('devuelve null cuando la empresa no publico la vuelta', () => {
    expect(buscarRutaInversa(ida, [ida])).toBeNull();
  });
});
