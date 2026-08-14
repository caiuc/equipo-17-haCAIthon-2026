/**
 * Generador pseudoaleatorio con semilla.
 *
 * Con --seed=N la corrida es reproducible: la misma micro se calla en el mismo
 * segundo en el ensayo y en la presentacion. Sin semilla cae a Math.random, que
 * en un script de demo es perfectamente valido.
 */
export type Rng = () => number;

/** mulberry32: 32 bits de estado, una linea, distribucion suficiente para esto. */
export const mulberry32 = (semilla: number): Rng => {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const crearRng = (semilla: number | null): Rng =>
  semilla === null ? Math.random : mulberry32(semilla);

/** Numero real en [min, max). */
export const entre = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

/** Entero en [min, max]. */
export const enteroEntre = (rng: Rng, min: number, max: number): number =>
  Math.floor(entre(rng, min, max + 1));
