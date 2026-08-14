/**
 * Buses Damir — Colina / Chicureo hacia Santiago, desde 2012.
 *
 * TARIFA: se siembra la vigente de 2026 (adulto 1100, estudiante 350). El
 * numero que mas circula en internet son los 1300 pesos de un articulo de
 * prensa de 2022: esta vencido y NO se usa. Es exactamente el caso que motiva
 * sourceCheckedAt — un dato viejo presentado como vigente es tan enganoso como
 * una posicion vieja presentada como fresca.
 *
 * ADULTO MAYOR: no lo publica. Sin fila, no un cero.
 */
import type { CompanySeed } from '../types.js';
import { WP, horarios, inverso, tarifas } from './waypoints.js';

const BORJA = 'Terminal San Borja';

// Adulto y estudiante vigentes 2026. El adulto mayor no aparece en la fuente.
const TARIFA = tarifas({ ADULT: 1100, STUDENT: 350 });

// Todos los dias con el mismo horario: asi lo publica la empresa.
const HORARIO = horarios(['04:45', '23:30'], ['04:45', '23:30'], ['04:45', '23:30']);

// Entra a Santiago por la Autopista Los Libertadores y baja por Independencia
// y Matucana hasta San Borja.
const COLINA_SANTIAGO = [
  WP.COLINA,
  WP.LIRAY,
  WP.METRO_LOS_LIBERTADORES,
  WP.AV_INDEPENDENCIA,
  WP.MATUCANA,
  WP.TERMINAL_SAN_BORJA,
];

const CHICUREO_SANTIAGO = [
  WP.CHICUREO,
  WP.CHAMISERO,
  WP.METRO_LOS_LIBERTADORES,
  WP.AV_INDEPENDENCIA,
  WP.TERMINAL_SAN_BORJA,
];

export const DAMIR: CompanySeed = {
  slug: 'damir',
  name: 'Buses Damir',
  rut: null,
  kind: 'PRIVATE',
  color: '#6D28D9',
  assetSlug: 'damir',
  phone: null,
  website: null,
  sourceUrl:
    'https://www.chicureohoy.cl/actualidad/colina-buses-damir-anuncia-alza-en-sus-tarifas-de-transporte-publico-hacia-santiago/',
  sourceCheckedAt: '2026-08-14',
  adminName: 'Admin Buses Damir',
  drivers: [
    { email: 'chofer1@damir.cl', name: 'Héctor Maldonado', licenseNumber: 'A3-620145' },
    { email: 'chofer2@damir.cl', name: 'Paula Riquelme', licenseNumber: 'A3-621390' },
  ],
  buses: [
    { plate: 'MNQB37', seats: null, assetSlug: null },
    { plate: 'SVTW90', seats: null, assetSlug: null },
  ],
  routes: [
    {
      code: 'DAM-LIB-IDA',
      name: 'Colina - Santiago por Los Libertadores',
      originName: 'Colina',
      destinationName: BORJA,
      stops: COLINA_SANTIAGO,
      schedules: HORARIO,
      fares: TARIFA,
    },
    {
      code: 'DAM-LIB-VTA',
      name: 'Santiago - Colina por Los Libertadores',
      originName: BORJA,
      destinationName: 'Colina',
      stops: inverso(COLINA_SANTIAGO),
      schedules: HORARIO,
      fares: TARIFA,
    },
    {
      code: 'DAM-CHI-IDA',
      name: 'Chicureo - Santiago',
      originName: 'Chicureo',
      destinationName: BORJA,
      stops: CHICUREO_SANTIAGO,
      schedules: HORARIO,
      fares: TARIFA,
    },
    {
      code: 'DAM-CHI-VTA',
      name: 'Santiago - Chicureo',
      originName: BORJA,
      destinationName: 'Chicureo',
      stops: inverso(CHICUREO_SANTIAGO),
      schedules: HORARIO,
      fares: TARIFA,
    },
  ],
};
