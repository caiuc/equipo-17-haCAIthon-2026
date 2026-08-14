import { describe, expect, it } from 'vitest';
import { TRAZADOS, trazadoDe } from '../../prisma/seed/data/trazados.js';
import { decodePolyline } from '../../src/lib/polyline.js';
import { claveTrazado, renderizarTrazados } from './archivo.js';

describe('renderizarTrazados', () => {
  it('indexa por empresa y codigo, no por id', () => {
    // El id es un cuid que se regenera en cada db:reset; (slug, code) es la
    // clave natural con la que el seed upsertea el recorrido.
    const fuente = renderizarTrazados([
      { companySlug: 'bupesa', routeCode: 'VIC-IDA', polilinea: 'abc' },
    ]);

    expect(fuente).toContain("'bupesa:VIC-IDA'");
  });

  it('escapa las barras invertidas, que aparecen en toda polilinea real', () => {
    const conBarra = 'f@pAXh@`@v@\\\\^vArA';
    const fuente = renderizarTrazados([{ companySlug: 'x', routeCode: 'Y', polilinea: conBarra }]);

    // El literal generado tiene que devolver EXACTAMENTE la cadena original.
    const literal = /'x:Y':\s*'([^]*?)',/.exec(fuente)?.[1] ?? '';
    expect(JSON.parse(`"${literal.replace(/\\'/g, "'")}"`)).toBe(conBarra);
  });

  it('ordena por clave para que dos exportaciones den el mismo diff', () => {
    const fuente = renderizarTrazados([
      { companySlug: 'zeta', routeCode: 'A', polilinea: 'a' },
      { companySlug: 'alfa', routeCode: 'B', polilinea: 'b' },
    ]);

    expect(fuente.indexOf('alfa:B')).toBeLessThan(fuente.indexOf('zeta:A'));
  });

  it('avisa que el archivo se commitea y por que', () => {
    const fuente = renderizarTrazados([]);

    expect(fuente).toContain('SE COMMITEA');
    expect(fuente).toContain('ARCHIVO GENERADO');
  });
});

describe('claveTrazado', () => {
  it('es empresa:codigo', () => {
    expect(claveTrazado('munibus', 'T4-VTA')).toBe('munibus:T4-VTA');
  });
});

/**
 * El archivo generado es un artefacto versionado: si alguien lo edita a mano o
 * lo trunca, las micros de produccion vuelven a la linea recta sin que nada mas
 * falle. Estas comprobaciones lo cuidan.
 */
describe('trazados.ts versionado', () => {
  it('trae los 63 recorridos', () => {
    expect(Object.keys(TRAZADOS)).toHaveLength(63);
  });

  it('cada trazado decodifica a un camino de verdad', () => {
    for (const [clave, polilinea] of Object.entries(TRAZADOS)) {
      const camino = decodePolyline(polilinea);
      expect(camino.length, clave).toBeGreaterThan(100);
      // Region Metropolitana de Chile: si un trazado cae fuera, se guardo mal.
      for (const punto of [camino[0]!, camino[camino.length - 1]!]) {
        expect(punto.lat, clave).toBeGreaterThan(-34.5);
        expect(punto.lat, clave).toBeLessThan(-32.5);
        expect(punto.lng, clave).toBeGreaterThan(-72);
        expect(punto.lng, clave).toBeLessThan(-70);
      }
    }
  });

  it('trazadoDe devuelve null para un recorrido que no tiene, sin lanzar', () => {
    expect(trazadoDe('bupesa', 'NO-EXISTE')).toBeNull();
    expect(trazadoDe('empresa-inventada', 'X')).toBeNull();
  });
});
