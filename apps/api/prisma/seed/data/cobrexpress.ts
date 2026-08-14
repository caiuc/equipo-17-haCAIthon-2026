/**
 * Buses Cobrexpress — Til Til y Colina hacia el Metro.
 *
 * Unica de las ocho con rut publico (razon social TRANSPORTES COBREXPRESS
 * LIMITADA), por eso es la unica que lo lleva sembrado.
 *
 * TARIFAS vigentes desde el 2026-04-27 y consultadas el 2026-04-25: es la ficha
 * mas antigua del seed y su sourceCheckedAt lo dice. El tramo de Til Til cobra
 * casi el doble que el de Colina porque es el doble de camino.
 *
 * DIAS: la fuente da una sola franja horaria sin distinguir tipo de dia, asi
 * que solo se siembra la de dia habil. Sabado y domingo quedan por confirmar.
 */
import type { CompanySeed } from '../types.js';
import { WP, horarios, inverso, tarifas } from './waypoints.js';

const HORARIO = horarios(['05:30', '23:00']);

const TARIFA_TILTIL = tarifas({ ADULT: 2600, STUDENT: 1300, SENIOR: 1300 });
const TARIFA_COLINA = tarifas({ ADULT: 1600, STUDENT: 500, SENIOR: 800 });

// Paradas en el orden que las publica la empresa: los tramos de camino
// (Camino a Til Til, Ruta 5, Panamericana) son puntos de la ruta, no
// terminales.
const TILTIL_VESPUCIO = [
  WP.TILTIL,
  { name: 'Camino a Til Til', lat: -33.12, lng: -70.9 },
  WP.PLAZUELA_POLPAICO,
  { name: 'Camino a Polpaico', lat: -33.2, lng: -70.83 },
  WP.RUTA_5_LAMPA,
  WP.PANAMERICANA_NORTE,
  WP.METRO_VESPUCIO_NORTE,
];

const COLINA_LIBERTADORES = [WP.COLINA, WP.LIRAY, WP.METRO_LOS_LIBERTADORES];

export const COBREXPRESS: CompanySeed = {
  slug: 'cobrexpress',
  name: 'Buses Cobrexpress',
  rut: '76.178.015-8',
  kind: 'PRIVATE',
  color: '#C2620E',
  assetSlug: 'cobrexpress',
  phone: '+56 2 2860 3111',
  website: null,
  sourceUrl: 'https://www.chicureohoy.cl/actualidad/cobrexpress-anuncia-alza-en-tarifas-de-buses/',
  sourceCheckedAt: '2026-04-25',
  adminName: 'Admin Cobrexpress',
  drivers: [
    { email: 'chofer1@cobrexpress.cl', name: 'Danilo Vergara', licenseNumber: 'A3-730551' },
    { email: 'chofer2@cobrexpress.cl', name: 'Sandra Ojeda', licenseNumber: 'A3-731064' },
    { email: 'chofer3@cobrexpress.cl', name: 'Jorge Espinoza', licenseNumber: 'A3-751340' },
    { email: 'chofer4@cobrexpress.cl', name: 'Daniela Munoz', licenseNumber: 'A3-751802' },
    { email: 'chofer5@cobrexpress.cl', name: 'Hugo Carrasco', licenseNumber: 'A3-752266' },
    { email: 'chofer6@cobrexpress.cl', name: 'Elena Poblete', licenseNumber: 'A3-752719' },
  ],
  buses: [
    { plate: 'PWRJ23', seats: null, assetSlug: null },
    { plate: 'TZGC58', seats: null, assetSlug: null },
    { plate: 'VBNL71', seats: null, assetSlug: null },
    { plate: 'HRFL52', seats: null, assetSlug: null },
    { plate: 'BCSB69', seats: null, assetSlug: null },
    { plate: 'LXCJ49', seats: null, assetSlug: null },
    { plate: 'LDXB89', seats: null, assetSlug: null },
  ],
  routes: [
    {
      code: 'TIL-IDA',
      name: 'Til Til - Metro Vespucio Norte',
      originName: 'Til Til',
      destinationName: 'EIM Vespucio Norte',
      stops: TILTIL_VESPUCIO,
      schedules: HORARIO,
      fares: TARIFA_TILTIL,
    },
    {
      code: 'TIL-VTA',
      name: 'Metro Vespucio Norte - Til Til',
      originName: 'EIM Vespucio Norte',
      destinationName: 'Til Til',
      stops: inverso(TILTIL_VESPUCIO),
      schedules: HORARIO,
      fares: TARIFA_TILTIL,
    },
    {
      code: 'COL-IDA',
      name: 'Colina - Metro Los Libertadores',
      originName: 'Colina',
      destinationName: 'Metro Los Libertadores',
      stops: COLINA_LIBERTADORES,
      schedules: HORARIO,
      fares: TARIFA_COLINA,
    },
    {
      code: 'COL-VTA',
      name: 'Metro Los Libertadores - Colina',
      originName: 'Metro Los Libertadores',
      destinationName: 'Colina',
      stops: inverso(COLINA_LIBERTADORES),
      schedules: HORARIO,
      fares: TARIFA_COLINA,
    },
  ],
};
