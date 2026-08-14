/**
 * Buses de Acercamiento Colina — servicio de la Ilustre Municipalidad de
 * Colina. Sin rut: es un servicio municipal, no una sociedad.
 *
 * TARIFA: la pagina no dice si es gratuito, y municipal NO implica gratis. Sin
 * dato publicado no hay fila Fare. Es la diferencia con MuniBus Paine, que si
 * declara ser gratuito y por eso lleva filas con amountClp 0.
 *
 * Opera de lunes a viernes con salidas contadas, no con frecuencia: el modelo
 * Schedule guarda la primera y la ultima de esas salidas.
 * M1  6:30 y 8:15 · M9  6:10 / 7:00 / 14:15 / 16:30 / 18:20 · M10  6:15.
 * La municipalidad publica las salidas por linea, no por sentido, asi que los
 * dos sentidos de cada linea llevan la misma franja.
 */
import type { CompanySeed } from '../types.js';
import { WP, horarios, inverso, SIN_TARIFA_PUBLICADA } from './waypoints.js';

const VESPUCIO = 'EIM Vespucio Norte';

const M1_STOPS = [WP.ESMERALDA, WP.COLINA, WP.LIRAY, WP.METRO_VESPUCIO_NORTE];
const M9_STOPS = [WP.COLINA, WP.CHICUREO, WP.PIEDRA_ROJA, WP.CHAMISERO];
const M10_STOPS = [WP.COLINA, WP.LIRAY, WP.METRO_VESPUCIO_NORTE];

export const COLINA: CompanySeed = {
  slug: 'colina',
  name: 'Buses de Acercamiento Colina',
  rut: null,
  kind: 'MUNICIPAL',
  color: '#334155',
  assetSlug: 'colina',
  phone: null,
  website: 'https://www.colina.cl',
  sourceUrl: 'https://www.colina.cl/buses-acercamiento/',
  sourceCheckedAt: '2026-08-14',
  adminName: 'Admin Acercamiento Colina',
  drivers: [
    { email: 'chofer1@colina.cl', name: 'Mauricio Tapia', licenseNumber: 'A3-950877' },
    { email: 'chofer2@colina.cl', name: 'Elena Paredes', licenseNumber: 'A3-951342' },
    { email: 'chofer3@colina.cl', name: 'Manuel Orellana', licenseNumber: 'A3-580129' },
    { email: 'chofer4@colina.cl', name: 'Teresa Alarcon', licenseNumber: 'A3-580673' },
    { email: 'chofer5@colina.cl', name: 'Diego Palma', licenseNumber: 'A3-581045' },
    { email: 'chofer6@colina.cl', name: 'Silvia Torres', licenseNumber: 'A3-581512' },
  ],
  buses: [
    { plate: 'CDWX35', seats: null, assetSlug: null },
    { plate: 'FYRH68', seats: null, assetSlug: null },
    { plate: 'TXKZ62', seats: null, assetSlug: null },
    { plate: 'YWDW37', seats: null, assetSlug: null },
    { plate: 'KXRJ56', seats: null, assetSlug: null },
    { plate: 'BYVC52', seats: null, assetSlug: null },
  ],
  routes: [
    {
      code: 'M1-IDA',
      name: 'M1 Esmeralda - Vespucio Norte',
      originName: 'Esmeralda',
      destinationName: VESPUCIO,
      stops: M1_STOPS,
      schedules: horarios(['06:30', '08:15']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'M1-VTA',
      name: 'M1 Vespucio Norte - Esmeralda',
      originName: VESPUCIO,
      destinationName: 'Esmeralda',
      stops: inverso(M1_STOPS),
      schedules: horarios(['06:30', '08:15']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'M9-IDA',
      name: 'M9 Colina - Piedra Roja / Chamisero',
      originName: 'Colina',
      destinationName: 'Chamisero',
      stops: M9_STOPS,
      schedules: horarios(['06:10', '18:20']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'M9-VTA',
      name: 'M9 Piedra Roja / Chamisero - Colina',
      originName: 'Chamisero',
      destinationName: 'Colina',
      stops: inverso(M9_STOPS),
      schedules: horarios(['06:10', '18:20']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'M10-IDA',
      name: 'M10 Colina - Vespucio Norte',
      originName: 'Colina',
      destinationName: VESPUCIO,
      stops: M10_STOPS,
      schedules: horarios(['06:15', '06:15']),
      fares: SIN_TARIFA_PUBLICADA,
    },
    {
      code: 'M10-VTA',
      name: 'M10 Vespucio Norte - Colina',
      originName: VESPUCIO,
      destinationName: 'Colina',
      stops: inverso(M10_STOPS),
      schedules: horarios(['06:15', '06:15']),
      fares: SIN_TARIFA_PUBLICADA,
    },
  ],
};
