/**
 * Islaval — Isla de Maipo / Santiago, operando desde 1993. Andenes 59 a 61 del
 * Terminal San Borja.
 *
 * TARIFAS: el sitio promete un tarifario, pero el enlace no existe. Sin dato
 * publicado no hay fila Fare: "no lo sabemos" no se escribe como un numero.
 *
 * Las localidades de cada recorrido van en el ORDEN que da la fuente. Los tres
 * salen del mismo punto (Álamo Huacho) y se diferencian por el camino que toman
 * a Santiago: troncal por Camino Melipilla, autopista, o Lonquén.
 */
import type { CompanySeed } from '../types.js';
import { WP, horarios, inverso, SIN_TARIFA_PUBLICADA } from './waypoints.js';

const BORJA = 'Terminal San Borja';
const ALAMO_HUACHO = 'Álamo Huacho';

// Mismo horario en los seis recorridos: la empresa lo publica por empresa, no
// por linea.
const HORARIO = horarios(['05:30', '22:00'], ['07:00', '22:00'], ['07:00', '22:00']);

const R720 = [
  WP.ALAMO_HUACHO,
  WP.SANTA_INES,
  WP.EL_MAITEN,
  WP.ISLA_DE_MAIPO,
  WP.TALAGANTE,
  WP.TREBULCO,
  WP.AUTOPISTA_SOL,
  WP.RUTA_78_MALLOCO,
  WP.CERRILLOS,
  WP.TERMINAL_SAN_BORJA,
];

const R721 = [
  WP.ALAMO_HUACHO,
  WP.EL_MAITEN,
  WP.ISLA_DE_MAIPO,
  WP.AUTOPISTA_SOL,
  WP.MAIPU,
  WP.TERMINAL_SAN_BORJA,
];

const R722 = [
  WP.ALAMO_HUACHO,
  WP.SANTA_INES,
  WP.ISLA_DE_MAIPO,
  WP.LONQUEN,
  WP.CERRILLOS,
  WP.TERMINAL_SAN_BORJA,
];

export const ISLAVAL: CompanySeed = {
  slug: 'islaval',
  name: 'Islaval',
  rut: null,
  kind: 'PRIVATE',
  color: '#0E8F8A',
  assetSlug: 'islaval',
  phone: null,
  website: 'https://islaval.cl',
  sourceUrl: 'https://islaval.cl/recorridos/',
  sourceCheckedAt: '2026-08-14',
  adminName: 'Admin Islaval',
  drivers: [
    { email: 'chofer1@islaval.cl', name: 'Patricio Salgado', licenseNumber: 'A3-510334' },
    { email: 'chofer2@islaval.cl', name: 'Nelly Cáceres', licenseNumber: 'A3-511208' },
    { email: 'chofer3@islaval.cl', name: 'Iván Bustos', licenseNumber: 'A3-512776' },
    { email: 'chofer4@islaval.cl', name: 'Mauricio Leiva', licenseNumber: 'A3-441203' },
    { email: 'chofer5@islaval.cl', name: 'Patricia Godoy', licenseNumber: 'A3-441667' },
    { email: 'chofer6@islaval.cl', name: 'Rene Sandoval', licenseNumber: 'A3-442018' },
  ],
  buses: [
    { plate: 'FGQR84', seats: null, assetSlug: null },
    { plate: 'HJVP15', seats: null, assetSlug: null },
    { plate: 'KLDT62', seats: null, assetSlug: null },
    { plate: 'XGVY53', seats: null, assetSlug: null },
    { plate: 'BVSC55', seats: null, assetSlug: null },
    { plate: 'CXSB61', seats: null, assetSlug: null },
  ],
  routes: [
    {
      code: 'R720-IDA',
      name: 'R720 Troncal Camino Melipilla',
      originName: ALAMO_HUACHO,
      destinationName: BORJA,
      stops: R720,
      schedules: HORARIO,
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'R720-VTA',
      name: 'R720 Troncal Camino Melipilla (regreso)',
      originName: BORJA,
      destinationName: ALAMO_HUACHO,
      stops: inverso(R720),
      schedules: HORARIO,
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'R721-IDA',
      name: 'R721 Autopista 21 de Mayo',
      originName: ALAMO_HUACHO,
      destinationName: BORJA,
      stops: R721,
      schedules: HORARIO,
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'R721-VTA',
      name: 'R721 Autopista 21 de Mayo (regreso)',
      originName: BORJA,
      destinationName: ALAMO_HUACHO,
      stops: inverso(R721),
      schedules: HORARIO,
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'R722-IDA',
      name: 'R722 Camino Lonquén',
      originName: ALAMO_HUACHO,
      destinationName: BORJA,
      stops: R722,
      schedules: HORARIO,
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'R722-VTA',
      name: 'R722 Camino Lonquén (regreso)',
      originName: BORJA,
      destinationName: ALAMO_HUACHO,
      stops: inverso(R722),
      schedules: HORARIO,
      fares: SIN_TARIFA_PUBLICADA,
    },
  ],
};
