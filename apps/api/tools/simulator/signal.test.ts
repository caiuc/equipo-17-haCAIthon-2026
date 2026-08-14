import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng.js';
import { crearSenal, planificarSenales } from './signal.js';

const TODO = { todoBueno: false, forzarCorte: false, forzarIntermitente: false };

/** 18 micros repartidas sobre 8 empresas, como sale del reparto round-robin. */
const flota18 = Array.from({ length: 18 }, (_, i) => {
  const slugs = [
    'bupesa',
    'talagante',
    'islaval',
    'damir',
    'cobrexpress',
    'paine',
    'munibus',
    'colina',
  ];
  return slugs[i % slugs.length] ?? 'bupesa';
});

describe('planificarSenales', () => {
  it('deja la mayoria en vivo y degrada solo una parte de la flota', () => {
    const plan = planificarSenales(flota18, TODO);
    const cuenta = (perfil: string): number =>
      plan.filter((entrada) => entrada.perfil === perfil).length;

    expect(plan).toHaveLength(18);
    expect(cuenta('BUENA')).toBeGreaterThanOrEqual(11);
    expect(cuenta('CORTE')).toBeGreaterThanOrEqual(1);
    expect(cuenta('INTERMITENTE')).toBeGreaterThanOrEqual(1);
  });

  it('degrada como maximo una micro por empresa', () => {
    const plan = planificarSenales(flota18, TODO);
    const degradadasPorEmpresa = new Map<string, number>();

    plan.forEach((entrada, indice) => {
      if (entrada.perfil === 'BUENA') return;
      const slug = flota18[indice] ?? '';
      degradadasPorEmpresa.set(slug, (degradadasPorEmpresa.get(slug) ?? 0) + 1);
    });

    expect(Math.max(0, ...degradadasPorEmpresa.values())).toBeLessThanOrEqual(1);
  });

  it('toda micro degradada tiene una sana de la misma empresa como espejo', () => {
    const plan = planificarSenales(flota18, TODO);

    plan.forEach((entrada, indice) => {
      if (entrada.perfil === 'BUENA') return;
      expect(entrada.espejo).not.toBeNull();
      const espejo = entrada.espejo ?? -1;
      expect(flota18[espejo]).toBe(flota18[indice]);
      expect(plan[espejo]?.perfil).toBe('BUENA');
    });
  });

  it('--all-good deja a todas transmitiendo', () => {
    const plan = planificarSenales(flota18, { ...TODO, todoBueno: true });

    expect(plan.every((entrada) => entrada.perfil === 'BUENA')).toBe(true);
  });

  it('--drop-signal degrada igual cuando la flota es una micro por empresa', () => {
    const plan = planificarSenales(['bupesa', 'paine'], { ...TODO, forzarCorte: true });

    expect(plan.filter((entrada) => entrada.perfil === 'CORTE')).toHaveLength(1);
  });
});

describe('crearSenal', () => {
  it('BUENA transmite siempre', () => {
    const senal = crearSenal('BUENA', mulberry32(1), 0);

    expect([0, 60_000, 600_000].every((ahora) => senal.transmite(ahora))).toBe(true);
  });

  it('CORTE enmudece a los ~45 s sin cerrar el turno', () => {
    const senal = crearSenal('CORTE', mulberry32(7), 0);

    expect(senal.transmite(10_000)).toBe(true);
    expect(senal.transmite(60_000)).toBe(false);
    expect(senal.transmite(600_000)).toBe(false);
  });

  it('INTERMITENTE encadena apagones largos y no solo perdidas sueltas', () => {
    const senal = crearSenal('INTERMITENTE', mulberry32(3), 0);
    const PING_MS = 4_000;

    // Ocho pings perdidos seguidos son los que hacen aparecer "Senal
    // intermitente" en pantalla: sin apagones eso casi nunca ocurre.
    let seguidos = 0;
    let maximo = 0;
    let transmitidos = 0;
    for (let t = 0; t <= 15 * 60_000; t += PING_MS) {
      if (senal.transmite(t)) {
        transmitidos += 1;
        seguidos = 0;
      } else {
        seguidos += 1;
        maximo = Math.max(maximo, seguidos);
      }
    }

    expect(maximo).toBeGreaterThanOrEqual(8);
    expect(transmitidos).toBeGreaterThan(0);
  });
});
