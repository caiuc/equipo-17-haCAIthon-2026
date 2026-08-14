import { describe, expect, it } from 'vitest';
import { BUSES_POR_DEFECTO, STAGGER_POR_DEFECTO_MS, parsearOpciones } from './cli.js';

describe('parsearOpciones', () => {
  it('trae valores por defecto utiles sin flags ni env', () => {
    const opciones = parsearOpciones([], {});

    expect(opciones.buses).toBe(BUSES_POR_DEFECTO);
    expect(opciones.apiUrl).toBe('http://localhost:3000');
    expect(opciones.staggerMs).toBe(STAGGER_POR_DEFECTO_MS);
    expect(opciones.semilla).toBeNull();
    expect(opciones.empresas).toEqual([]);
  });

  it('lee la semilla en sus dos formas', () => {
    expect(parsearOpciones(['--seed=17'], {}).semilla).toBe(17);
    expect(parsearOpciones(['--seed', '17'], {}).semilla).toBe(17);
  });

  it('reconoce los flags de la demo', () => {
    const opciones = parsearOpciones(
      ['--wait-for-api', '--once', '--cleanup', '--drop-signal', '--flaky', '--stagger-ms=400'],
      {},
    );

    expect(opciones.esperarApi).toBe(true);
    expect(opciones.unaVuelta).toBe(true);
    expect(opciones.limpiar).toBe(true);
    expect(opciones.forzarCorte).toBe(true);
    expect(opciones.forzarIntermitente).toBe(true);
    expect(opciones.staggerMs).toBe(400);
  });

  it('BUSES y COMPANIES vienen del entorno', () => {
    const opciones = parsearOpciones([], { BUSES: '18', COMPANIES: 'paine, colina' });

    expect(opciones.buses).toBe(18);
    expect(opciones.empresas).toEqual(['paine', 'colina']);
  });

  it('ignora un BUSES invalido en vez de arrancar con cero micros', () => {
    expect(parsearOpciones([], { BUSES: 'x' }).buses).toBe(BUSES_POR_DEFECTO);
    expect(parsearOpciones([], { BUSES: '0' }).buses).toBe(BUSES_POR_DEFECTO);
  });

  it('quita la barra final del API_URL para no armar rutas con doble barra', () => {
    expect(parsearOpciones([], { API_URL: 'https://api.demo.cl/' }).apiUrl).toBe(
      'https://api.demo.cl',
    );
  });
});
