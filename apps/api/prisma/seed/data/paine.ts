/**
 * Buses Paine — Aculeo, La Paloma y Chada hacia el Terminal San Borja.
 *
 * TARIFAS: no las publica en ningun canal. Sin filas Fare.
 *
 * Es la unica empresa privada del seed con asientos sembrados: la fuente
 * describe la flota como minibuses Mercedes y Volkswagen de 19 y 20 pasajeros.
 * Del resto de las empresas no hay dato de capacidad, y ahi `seats` queda null.
 *
 * De Aculeo la fuente da dia habil y domingo; de La Paloma y Chada solo una
 * franja por sentido, que se siembra como dia habil.
 */
import type { CompanySeed } from '../types.js';
import {
  A_SANTIAGO_DESDE_PAINE,
  WP,
  horarios,
  inverso,
  SIN_TARIFA_PUBLICADA,
} from './waypoints.js';

const BORJA = 'Terminal San Borja';

const ACULEO_SANTIAGO = [
  WP.LAGUNA_ACULEO,
  WP.PINTUE,
  WP.RANGUE,
  WP.CHAMPA,
  WP.PAINE,
  ...A_SANTIAGO_DESDE_PAINE,
];

const PALOMA_SANTIAGO = [WP.LA_PALOMA, WP.PAINE, ...A_SANTIAGO_DESDE_PAINE];

const CHADA_SANTIAGO = [WP.CULITRIN, WP.CHADA, WP.HUELQUEN, WP.PAINE, ...A_SANTIAGO_DESDE_PAINE];

export const PAINE: CompanySeed = {
  slug: 'paine',
  name: 'Buses Paine',
  rut: null,
  kind: 'PRIVATE',
  color: '#2E7D32',
  assetSlug: 'paine',
  phone: '+56 2 2778 1265',
  website: null,
  sourceUrl: 'https://www.horariodebuses.cl/buses-paine',
  sourceCheckedAt: '2026-08-14',
  adminName: 'Admin Buses Paine',
  drivers: [
    { email: 'chofer1@paine.cl', name: 'Alfredo Cornejo', licenseNumber: 'A3-840219' },
    { email: 'chofer2@paine.cl', name: 'Rosa Antimil', licenseNumber: 'A3-841503' },
  ],
  buses: [
    { plate: 'GHDR46', seats: 19, assetSlug: null },
    { plate: 'JKPT80', seats: 20, assetSlug: null },
    { plate: 'NRLB12', seats: 19, assetSlug: null },
  ],
  routes: [
    {
      code: 'PAI-ACU-IDA',
      name: 'Aculeo - San Borja',
      originName: 'Laguna de Aculeo',
      destinationName: BORJA,
      stops: ACULEO_SANTIAGO,
      schedules: horarios(['05:00', '19:30'], undefined, ['06:00', '20:00']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'PAI-ACU-VTA',
      name: 'San Borja - Aculeo',
      originName: BORJA,
      destinationName: 'Laguna de Aculeo',
      stops: inverso(ACULEO_SANTIAGO),
      schedules: horarios(['05:00', '19:30'], undefined, ['06:00', '20:00']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'PAI-PAL-IDA',
      name: 'La Paloma - San Borja',
      originName: 'La Paloma',
      destinationName: BORJA,
      stops: PALOMA_SANTIAGO,
      schedules: horarios(['05:00', '20:40']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'PAI-PAL-VTA',
      name: 'San Borja - La Paloma',
      originName: BORJA,
      destinationName: 'La Paloma',
      stops: inverso(PALOMA_SANTIAGO),
      schedules: horarios(['06:00', '23:00']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'PAI-CHA-IDA',
      name: 'Chada - San Borja',
      originName: 'Culitrín',
      destinationName: BORJA,
      stops: CHADA_SANTIAGO,
      schedules: horarios(['07:00', '19:00']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'PAI-CHA-VTA',
      name: 'San Borja - Chada',
      originName: BORJA,
      destinationName: 'Culitrín',
      stops: inverso(CHADA_SANTIAGO),
      schedules: horarios(['08:00', '21:00']),
      fares: SIN_TARIFA_PUBLICADA,
    },
  ],
};
