/**
 * Buses Peñaflor (Bupesa) — Asociacion Gremial de Dueños de Minibuses Peñaflor
 * – Santiago.
 *
 * Recorridos, sentidos y horarios salen del PDF publico de horarios de la
 * empresa. Cada SENTIDO es un recorrido propio, tal como el PDF los lista en
 * tablas separadas ("desde Terminal Peñaflor" / "desde Terminal San Borja").
 *
 * Tarifas del PDF `Tarifas-Bupesa.pdf` (generado el 2025-12-30). La asimetria
 * del pasaje escolar es real y esta en la fuente: 400 pesos saliendo de
 * Peñaflor, 450 saliendo de San Borja. Se siembra tal como la publican.
 *
 * Es la unica de las ocho empresas sin rut publico: es asociacion gremial.
 */
import type { CompanySeed } from '../types.js';
import { A_SANTIAGO, A_SANTIAGO_EXPRESO, WP, horarios, inverso, tarifas } from './waypoints.js';

const PENAFLOR = 'Terminal Peñaflor';
const BORJA = 'Terminal San Borja';
const SANTA_ROSA = 'Terminal Santa Rosa';
const CALERA = 'Terminal Calera de Tango';
const CASAS_VIEJAS = 'Casas Viejas';

// Peñaflor <-> San Borja por Camino Melipilla.
const CORRIENTE_IDA = tarifas({ ADULT: 1350, STUDENT: 400, SENIOR: 650 });
const CORRIENTE_VUELTA = tarifas({ ADULT: 1350, STUDENT: 450, SENIOR: 650 });
// Los servicios por Autopista del Sol cobran el peaje al pasajero.
const AUTOPISTA = tarifas({ ADULT: 1450, STUDENT: 450, SENIOR: 700 });
const CALERA_TARIFA = tarifas({ ADULT: 1250, STUDENT: 400, SENIOR: 600 });
// Sta. Rosa y Vizcachas no salen de la Region: es el tramo mas corto y barato.
const LOCAL = tarifas({ ADULT: 1000, STUDENT: 300, SENIOR: 500 });

const STA_ROSA_STOPS = [
  WP.SANTA_ROSA,
  WP.LA_CISTERNA,
  WP.LO_ESPEJO,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

const CALERA_STOPS = [
  WP.CALERA_DE_TANGO,
  WP.SAN_BERNARDO,
  WP.LO_ESPEJO,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

const VIZCACHAS_POR_PUENTE_ALTO = [
  WP.TERMINAL_PENAFLOR,
  WP.MALLOCO,
  WP.CALERA_DE_TANGO,
  WP.SAN_BERNARDO,
  WP.BELLAVISTA_LA_FLORIDA,
  WP.PUENTE_ALTO,
  WP.LAS_VIZCACHAS,
  WP.CASAS_VIEJAS,
];

const VIZCACHAS_POR_ESPEJO = [
  WP.TERMINAL_PENAFLOR,
  WP.MALLOCO,
  WP.LO_ESPEJO,
  WP.LA_CISTERNA,
  WP.BELLAVISTA_LA_FLORIDA,
  WP.PUENTE_ALTO,
  WP.LAS_VIZCACHAS,
  WP.CASAS_VIEJAS,
];

export const BUPESA: CompanySeed = {
  slug: 'bupesa',
  name: 'Buses Peñaflor (Bupesa)',
  rut: null,
  kind: 'PRIVATE',
  color: '#1B5FC1',
  assetSlug: 'bupesa',
  phone: '+56 2 2812 9177',
  website: 'https://bupesa.cl',
  sourceUrl: 'https://bupesa.cl/tarifas/',
  sourceCheckedAt: '2026-08-14',
  adminName: 'Admin Bupesa',
  drivers: [
    { email: 'chofer1@bupesa.cl', name: 'Luis Farías', licenseNumber: 'A3-114455' },
    { email: 'chofer2@bupesa.cl', name: 'Marta Núñez', licenseNumber: 'A3-228877' },
    { email: 'chofer3@bupesa.cl', name: 'José Quintana', licenseNumber: 'A3-330099' },
  ],
  buses: [
    { plate: 'JTKR52', seats: null, assetSlug: null },
    { plate: 'LBWD18', seats: null, assetSlug: null },
    { plate: 'PFZC73', seats: null, assetSlug: null },
    { plate: 'RHVN46', seats: null, assetSlug: null },
  ],
  routes: [
    // --- Desde Terminal Peñaflor hacia Terminal San Borja ---
    {
      code: 'VIC-IDA',
      name: 'Vicuña Corriente',
      originName: PENAFLOR,
      destinationName: BORJA,
      stops: [WP.TERMINAL_PENAFLOR, WP.VICUNA, ...A_SANTIAGO],
      schedules: horarios(['4:23', '21:33'], ['4:38', '21:33'], ['4:50', '21:08']),
      fares: CORRIENTE_IDA,
    },
    {
      code: 'PRA-IDA',
      name: 'Praderas Corriente',
      originName: PENAFLOR,
      destinationName: BORJA,
      stops: [WP.TERMINAL_PENAFLOR, WP.PRADERAS, ...A_SANTIAGO],
      schedules: horarios(['4:50', '20:17'], ['4:55', '20:15'], ['5:05', '20:10']),
      fares: CORRIENTE_IDA,
    },
    {
      code: 'MIR-IDA',
      name: 'Miraflores Corriente',
      originName: PENAFLOR,
      destinationName: BORJA,
      stops: [WP.TERMINAL_PENAFLOR, WP.MIRAFLORES, ...A_SANTIAGO],
      // Sin domingo: asi lo lista el PDF.
      schedules: horarios(['5:20', '19:00'], ['6:00', '19:00']),
      fares: CORRIENTE_IDA,
    },
    {
      code: 'AUT-VIC-IDA',
      name: 'Autopista Vicuña',
      originName: PENAFLOR,
      destinationName: BORJA,
      stops: [WP.TERMINAL_PENAFLOR, WP.VICUNA, ...A_SANTIAGO_EXPRESO],
      schedules: horarios(['5:00', '18:36']),
      fares: AUTOPISTA,
    },
    {
      code: 'AUT-PRA-IDA',
      name: 'Autopista Praderas',
      originName: PENAFLOR,
      destinationName: BORJA,
      stops: [WP.TERMINAL_PENAFLOR, WP.PRADERAS, ...A_SANTIAGO_EXPRESO],
      schedules: horarios(['5:20', '19:00']),
      fares: AUTOPISTA,
    },
    {
      code: 'AUT-MIR-IDA',
      name: 'Autopista Miraflores',
      originName: PENAFLOR,
      destinationName: BORJA,
      stops: [WP.TERMINAL_PENAFLOR, WP.MIRAFLORES, ...A_SANTIAGO_EXPRESO],
      schedules: horarios(['5:30', '18:50']),
      fares: AUTOPISTA,
    },

    // --- Desde Terminal San Borja hacia Terminal Peñaflor (regreso) ---
    {
      code: 'VIC-VTA',
      name: 'Vicuña Corriente (regreso)',
      originName: BORJA,
      destinationName: PENAFLOR,
      stops: inverso([WP.TERMINAL_PENAFLOR, WP.VICUNA, ...A_SANTIAGO]),
      schedules: horarios(['6:05', '23:25'], ['6:30', '23:25'], ['6:30', '23:00']),
      fares: CORRIENTE_VUELTA,
    },
    {
      code: 'PRA-VTA',
      name: 'Praderas Corriente (regreso)',
      originName: BORJA,
      destinationName: PENAFLOR,
      stops: inverso([WP.TERMINAL_PENAFLOR, WP.PRADERAS, ...A_SANTIAGO]),
      schedules: horarios(['6:22', '22:00'], ['6:45', '22:00'], ['6:54', '22:00']),
      fares: CORRIENTE_VUELTA,
    },
    {
      code: 'MIR-VTA',
      name: 'Miraflores Corriente (regreso)',
      originName: BORJA,
      destinationName: PENAFLOR,
      stops: inverso([WP.TERMINAL_PENAFLOR, WP.MIRAFLORES, ...A_SANTIAGO]),
      schedules: horarios(['6:35', '18:15'], ['7:40', '21:30']),
      fares: CORRIENTE_VUELTA,
    },
    {
      code: 'STR-VTA',
      name: 'Sta. Rosa (regreso)',
      originName: BORJA,
      destinationName: SANTA_ROSA,
      stops: inverso(STA_ROSA_STOPS),
      schedules: horarios(['6:20', '21:40'], ['6:40', '21:00'], ['6:31', '22:30']),
      fares: LOCAL,
    },
    {
      code: 'CAL-VTA',
      name: 'Calera de Tango (regreso)',
      originName: BORJA,
      destinationName: CALERA,
      stops: inverso(CALERA_STOPS),
      schedules: horarios(['5:51', '22:30'], ['6:10', '22:30'], ['6:31', '22:30']),
      fares: CALERA_TARIFA,
    },

    // --- Hacia Terminal San Borja desde los otros terminales ---
    {
      code: 'STR-IDA',
      name: 'Sta. Rosa',
      originName: SANTA_ROSA,
      destinationName: BORJA,
      stops: STA_ROSA_STOPS,
      schedules: horarios(['5:00', '20:20']),
      fares: LOCAL,
    },
    {
      code: 'CAL-IDA',
      name: 'Calera de Tango',
      originName: CALERA,
      destinationName: BORJA,
      stops: CALERA_STOPS,
      schedules: horarios(['4:21', '20:50']),
      fares: CALERA_TARIFA,
    },

    // --- Terminal Peñaflor <-> Casas Viejas ---
    {
      code: 'VIZ-PA-IDA',
      name: 'Vizcachas por Puente Alto',
      originName: PENAFLOR,
      destinationName: CASAS_VIEJAS,
      stops: VIZCACHAS_POR_PUENTE_ALTO,
      schedules: horarios(['3:55', '19:50']),
      fares: LOCAL,
    },
    {
      code: 'VIZ-PA-VTA',
      name: 'Vizcachas por Puente Alto (regreso)',
      originName: CASAS_VIEJAS,
      destinationName: PENAFLOR,
      stops: inverso(VIZCACHAS_POR_PUENTE_ALTO),
      schedules: horarios(['5:47', '22:08']),
      fares: LOCAL,
    },
    {
      code: 'VIZ-ES-IDA',
      name: 'Vizcachas por Espejo',
      originName: PENAFLOR,
      destinationName: CASAS_VIEJAS,
      stops: VIZCACHAS_POR_ESPEJO,
      schedules: horarios(['3:52', '19:44']),
      fares: LOCAL,
    },
    {
      code: 'VIZ-ES-VTA',
      name: 'Vizcachas por Espejo (regreso)',
      originName: CASAS_VIEJAS,
      destinationName: PENAFLOR,
      stops: inverso(VIZCACHAS_POR_ESPEJO),
      schedules: horarios(['5:47', '21:52']),
      fares: LOCAL,
    },
  ],
};
