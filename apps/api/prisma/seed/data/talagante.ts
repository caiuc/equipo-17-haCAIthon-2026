/**
 * Buses Flota Talagante.
 *
 * TARIFAS: no las publica en ningun canal. Por eso no lleva ninguna fila Fare —
 * y eso es distinto de valer cero. La interfaz debe decir "tarifa por
 * confirmar", no "gratis".
 *
 * De la fuente solo salen las primeras y ultimas salidas de dia habil; no
 * publica tabla de sabado ni de domingo, asi que tampoco se siembran.
 */
import type { CompanySeed } from '../types.js';
import { WP, horarios, inverso, SIN_TARIFA_PUBLICADA } from './waypoints.js';

const BORJA = 'Terminal San Borja';

const TALAGANTE_SANTIAGO = [
  WP.TERMINAL_TALAGANTE,
  WP.TALAGANTE,
  WP.MALLOCO,
  WP.PADRE_HURTADO,
  WP.MAIPU,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

// Por Camino Lonquén, no por la Autopista del Sol: es el recorrido lento.
const ISLA_SANTIAGO = [
  WP.ISLA_DE_MAIPO,
  WP.LA_ISLITA,
  WP.LONQUEN,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

// El unico que no termina en San Borja: cruza Santiago por Vespucio hasta
// Bellavista de La Florida.
const MONTE_FLORIDA = [
  WP.EL_MONTE,
  WP.TALAGANTE,
  WP.MALLOCO,
  WP.PADRE_HURTADO,
  WP.MAIPU,
  WP.CERRILLOS,
  WP.LO_ESPEJO,
  WP.LA_CISTERNA,
  WP.BELLAVISTA_LA_FLORIDA,
];

export const TALAGANTE: CompanySeed = {
  slug: 'talagante',
  name: 'Buses Flota Talagante',
  rut: null,
  kind: 'PRIVATE',
  color: '#B3261E',
  assetSlug: 'talagante',
  phone: '+56 22 815 4496',
  website: 'https://flotatalagante.cl',
  sourceUrl: 'https://www.horariodebuses.cl/buses-flota-talagante',
  sourceCheckedAt: '2026-08-14',
  adminName: 'Admin Flota Talagante',
  drivers: [
    { email: 'chofer1@talagante.cl', name: 'Rodrigo Pizarro', licenseNumber: 'A3-401122' },
    { email: 'chofer2@talagante.cl', name: 'Carmen Lillo', licenseNumber: 'A3-401987' },
    { email: 'chofer3@talagante.cl', name: 'Nelson Aguirre', licenseNumber: 'A3-330214' },
    { email: 'chofer4@talagante.cl', name: 'Carla Mendez', licenseNumber: 'A3-330788' },
    { email: 'chofer5@talagante.cl', name: 'Ivan Rojas', licenseNumber: 'A3-331092' },
    { email: 'chofer6@talagante.cl', name: 'Sonia Herrera', licenseNumber: 'A3-331455' },
  ],
  buses: [
    { plate: 'BXHT41', seats: null, assetSlug: null },
    { plate: 'CKMD67', seats: null, assetSlug: null },
    { plate: 'DTLS29', seats: null, assetSlug: null },
    { plate: 'RTGZ17', seats: null, assetSlug: null },
    { plate: 'GJGZ81', seats: null, assetSlug: null },
    { plate: 'JRZF91', seats: null, assetSlug: null },
    { plate: 'DPVD74', seats: null, assetSlug: null },
  ],
  routes: [
    {
      code: 'TAL-IDA',
      name: 'Talagante - San Borja',
      originName: 'Terminal Talagante',
      destinationName: BORJA,
      stops: TALAGANTE_SANTIAGO,
      schedules: horarios(['04:00', '20:40']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'TAL-VTA',
      name: 'San Borja - Talagante',
      originName: BORJA,
      destinationName: 'Terminal Talagante',
      stops: inverso(TALAGANTE_SANTIAGO),
      schedules: horarios(['06:00', '22:48']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'ISL-IDA',
      name: 'Isla de Maipo - San Borja por Lonquén',
      originName: 'Isla de Maipo',
      destinationName: BORJA,
      stops: ISLA_SANTIAGO,
      schedules: horarios(['04:00', '20:45']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'ISL-VTA',
      name: 'San Borja - Isla de Maipo por Lonquén',
      originName: BORJA,
      destinationName: 'Isla de Maipo',
      stops: inverso(ISLA_SANTIAGO),
      schedules: horarios(['05:00', '22:45']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'MON-IDA',
      name: 'El Monte - Bellavista de La Florida',
      originName: 'El Monte',
      destinationName: 'Bellavista de La Florida',
      stops: MONTE_FLORIDA,
      schedules: horarios(['04:00', '20:45']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'MON-VTA',
      name: 'Bellavista de La Florida - El Monte',
      originName: 'Bellavista de La Florida',
      destinationName: 'El Monte',
      stops: inverso(MONTE_FLORIDA),
      schedules: horarios(['06:00', '21:45']),
      fares: SIN_TARIFA_PUBLICADA,
    },
  ],
};
