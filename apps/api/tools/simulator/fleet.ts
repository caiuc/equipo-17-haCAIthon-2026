/**
 * Armado de la flota: que chofer maneja que micro y donde arranca cada una.
 * Funciones puras; nada de red ni de reloj.
 */
import { largosDeTramos } from './motion.js';
import type { Asignacion, EmpresaSemilla, Punto, RutaResumen } from './types.js';

/**
 * Reparto round-robin POR EMPRESA, no por indice global sobre una lista plana de
 * choferes: con `DRIVERS[i % DRIVERS.length]` las primeras dos o tres empresas
 * se llevan todas las micros y el mapa sale de un solo color. Por vueltas,
 * BUSES=8 da las 8 empresas con una micro cada una.
 */
export const repartirPorEmpresa = (empresas: EmpresaSemilla[], total: number): Asignacion[] => {
  const asignaciones: Asignacion[] = [];
  const vueltas = empresas.reduce((maximo, empresa) => Math.max(maximo, empresa.drivers.length), 0);

  for (let vuelta = 0; vuelta < vueltas && asignaciones.length < total; vuelta += 1) {
    for (const empresa of empresas) {
      if (asignaciones.length >= total) break;
      const chofer = empresa.drivers[vuelta];
      // Empresa con menos choferes que la vuelta actual: se la saltea y las
      // demas siguen. Nadie recibe dos micros antes de que todas tengan una.
      if (!chofer) continue;
      asignaciones.push({
        empresaSlug: empresa.slug,
        empresaNombre: empresa.name,
        email: chofer.email,
        nombre: chofer.name,
        ordinal: vuelta,
      });
    }
  }

  return asignaciones;
};

export const filtrarEmpresas = (empresas: EmpresaSemilla[], slugs: string[]): EmpresaSemilla[] => {
  if (slugs.length === 0) return empresas;
  const pedidos = new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean));
  return empresas.filter((empresa) => pedidos.has(empresa.slug.toLowerCase()));
};

/** Razon aurea: secuencia de baja discrepancia, sin dos micros pegadas. */
export const RAZON_AUREA = 0.6180339887;

/**
 * Fraccion del recorrido donde arranca la micro `indice`.
 *
 * Se deja un margen en los extremos (0,05 a 0,90) para que ninguna nazca encima
 * del terminal y de la vuelta en el primer tick.
 */
export const fraccionDispersion = (indice: number): number =>
  0.05 + ((indice * RAZON_AUREA) % 1) * 0.85;

/**
 * Convierte una fraccion del recorrido a (tramo, avance) repartiendo por METROS
 * acumulados, no por indice de paradero.
 *
 * Los tramos de estos recorridos van de 1,6 km a 8 km: dispersar por indice
 * amontona las micros en los tramos urbanos cortos, que son muchos y miden poco,
 * y deja vacio el interurbano, que es la mitad del largo real.
 */
export const ubicarPorMetros = (
  stops: Punto[],
  fraccion: number,
): { tramo: number; avance: number } => {
  const largos = largosDeTramos(stops);
  if (largos.length === 0) return { tramo: 0, avance: 0 };

  const total = largos.reduce((suma, largo) => suma + largo, 0);
  let objetivo = Math.min(Math.max(fraccion, 0), 1) * total;

  for (let tramo = 0; tramo < largos.length; tramo += 1) {
    const largo = largos[tramo] ?? 1;
    if (objetivo <= largo || tramo === largos.length - 1) {
      return { tramo, avance: Math.min(1, objetivo / largo) };
    }
    objetivo -= largo;
  }

  return { tramo: largos.length - 1, avance: 1 };
};

/** Largo total del recorrido en metros. Solo para el log de arranque. */
export const largoTotalM = (stops: Punto[]): number =>
  largosDeTramos(stops).reduce((suma, largo) => suma + largo, 0);

/**
 * El recorrido de vuelta.
 *
 * Cada sentido es un recorrido propio (ver CLAUDE.md), asi que la vuelta existe
 * como otra fila: se la reconoce porque su origen es el destino de esta y
 * viceversa. Si la empresa no la publico, el orquestador invierte los paraderos
 * del mismo recorrido, que es peor pero sigue siendo mejor que teletransportar
 * la micro al origen.
 */
export const buscarRutaInversa = (
  actual: { id: string; code: string; originName: string; destinationName: string },
  candidatas: RutaResumen[],
): RutaResumen | null => {
  const normal = (texto: string): string => texto.trim().toLowerCase();

  const opuestas = candidatas.filter(
    (ruta) =>
      ruta.id !== actual.id &&
      normal(ruta.originName) === normal(actual.destinationName) &&
      normal(ruta.destinationName) === normal(actual.originName),
  );

  // Varias rutas de la empresa pueden unir los mismos dos terminales por caminos
  // distintos (AUT-MIR, MIR, AUT-PRA...). Se prefiere la que comparte prefijo de
  // codigo: es la vuelta del MISMO corredor, no otra variante.
  const prefijoComun = (codigo: string): number => {
    let largo = 0;
    while (
      largo < codigo.length &&
      largo < actual.code.length &&
      codigo[largo] === actual.code[largo]
    ) {
      largo += 1;
    }
    return largo;
  };

  return [...opuestas].sort((a, b) => prefijoComun(b.code) - prefijoComun(a.code))[0] ?? null;
};
