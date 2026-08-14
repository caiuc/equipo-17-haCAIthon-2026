/**
 * Las ocho empresas del seed, como datos y nada mas.
 *
 * REGLA DURA DE ESTE DIRECTORIO: `data/` no importa Prisma ni ejecuta nada.
 * Solo estructuras. El simulador y cualquier herramienta pueden importar
 * COMPANIES sin que eso abra una conexion a Postgres como efecto colateral de
 * un import. Quien escribe en la base es seed/index.ts, y solo el.
 *
 * El orden es el de la demo: Bupesa primero porque es la empresa con datos mas
 * completos (horarios y tarifas de su PDF oficial), y MuniBus Paine cerca del
 * final porque es la unica con paraderos GPS verificados.
 */
import type { CompanySeed } from '../types.js';
import { BUPESA } from './bupesa.js';
import { TALAGANTE } from './talagante.js';
import { ISLAVAL } from './islaval.js';
import { DAMIR } from './damir.js';
import { COBREXPRESS } from './cobrexpress.js';
import { PAINE } from './paine.js';
import { MUNIBUS } from './munibus.js';
import { COLINA } from './colina.js';

export const COMPANIES: CompanySeed[] = [
  BUPESA,
  TALAGANTE,
  ISLAVAL,
  DAMIR,
  COBREXPRESS,
  PAINE,
  MUNIBUS,
  COLINA,
];

/** Clave unica de todas las cuentas de demo. Solo sirve para la demo. */
export const DEMO_PASSWORD = 'demo1234';

/** Cuentas que no pertenecen a ninguna empresa. */
export const SUPERADMIN = { email: 'superadmin@demo.cl', name: 'Super Admin' };
export const PASAJERO = { email: 'pasajero@demo.cl', name: 'Ana Rivas' };
