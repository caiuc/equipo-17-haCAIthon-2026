/**
 * Puntos del mapa compartidos por las ocho empresas, mas los tres azucares que
 * usan todos los archivos de `data/`.
 *
 * Vive en un solo archivo porque el Terminal San Borja lo comparten seis de las
 * ocho empresas y la Estacion Central cinco: duplicarlos por empresa pondria
 * seis San Borja distintos en el mapa, separados por decenas de metros, y el
 * pasajero veria seis paraderos donde hay uno.
 *
 * Las coordenadas estan geocodificadas contra OpenStreetMap. Aun asi son
 * APROXIMADAS como paradero: identifican la localidad o el terminal, no el
 * poste donde para la micro (ver banner.ts).
 */
import type { FareSeed, ScheduleSeed, Waypoint } from '../types.js';
import { DAY_TYPES, PASSENGER_TYPES } from '@equipo17/shared';

export const WP = {
  // --- Santiago ---
  TERMINAL_SAN_BORJA: { name: 'Terminal San Borja', lat: -33.4545, lng: -70.67987 },
  ESTACION_CENTRAL: { name: 'Estación Central', lat: -33.45364, lng: -70.68987 },
  TERMINAL_LA_PAZ: { name: 'Terminal La Paz', lat: -33.42893, lng: -70.65147 },
  METRO_PARQUE_OHIGGINS: { name: "Metro Parque O'Higgins", lat: -33.45539, lng: -70.66019 },
  METRO_ESCUELA_MILITAR: { name: 'Metro Escuela Militar', lat: -33.41348, lng: -70.58268 },
  AV_INDEPENDENCIA: { name: 'Av. Independencia', lat: -33.43149, lng: -70.65288 },
  MATUCANA: { name: 'Matucana', lat: -33.44555, lng: -70.67957 },
  CERRILLOS: { name: 'Cerrillos', lat: -33.50234, lng: -70.71584 },
  MAIPU: { name: 'Maipú', lat: -33.50944, lng: -70.75618 },
  LO_ESPEJO: { name: 'Lo Espejo', lat: -33.52508, lng: -70.69454 },
  LA_CISTERNA: { name: 'La Cisterna', lat: -33.53463, lng: -70.6644 },
  BELLAVISTA_LA_FLORIDA: { name: 'Bellavista de La Florida', lat: -33.51952, lng: -70.60003 },
  PUENTE_ALTO: { name: 'Puente Alto', lat: -33.60953, lng: -70.57547 },
  LAS_VIZCACHAS: { name: 'Las Vizcachas', lat: -33.59768, lng: -70.51535 },
  CASAS_VIEJAS: { name: 'Casas Viejas', lat: -33.60822, lng: -70.5322 },
  SAN_BERNARDO: { name: 'San Bernardo', lat: -33.59229, lng: -70.70458 },
  NOS: { name: 'Nos', lat: -33.63227, lng: -70.70461 },
  CALERA_DE_TANGO: { name: 'Calera de Tango', lat: -33.63094, lng: -70.75932 },

  // --- Corredor Peñaflor / Talagante / Melipilla (Ruta 78) ---
  TERMINAL_PENAFLOR: { name: 'Terminal Peñaflor', lat: -33.6182, lng: -70.90739 },
  PENAFLOR: { name: 'Peñaflor', lat: -33.60586, lng: -70.87853 },
  MALLOCO: { name: 'Malloco', lat: -33.60793, lng: -70.85841 },
  PADRE_HURTADO: { name: 'Padre Hurtado', lat: -33.56731, lng: -70.80205 },
  AUTOPISTA_SOL: { name: 'Autopista del Sol', lat: -33.59, lng: -70.82 },
  RUTA_78_MALLOCO: { name: 'Camino a Melipilla (Ruta 78)', lat: -33.62, lng: -70.87 },
  TALAGANTE: { name: 'Talagante', lat: -33.66444, lng: -70.93028 },
  TERMINAL_TALAGANTE: { name: 'Terminal Talagante', lat: -33.67765, lng: -70.95497 },
  TREBULCO: { name: 'Trebulco', lat: -33.67888, lng: -70.94706 },
  EL_MONTE: { name: 'El Monte', lat: -33.66782, lng: -71.02724 },
  EL_PAICO: { name: 'El Paico', lat: -33.68894, lng: -71.04892 },
  MELIPILLA: { name: 'Melipilla', lat: -33.68551, lng: -71.21458 },
  BOLLENAR: { name: 'Bollenar', lat: -33.56965, lng: -71.21196 },
  LONQUEN: { name: 'Av. Lonquén', lat: -33.71133, lng: -70.85501 },

  // --- Isla de Maipo ---
  ISLA_DE_MAIPO: { name: 'Isla de Maipo', lat: -33.75374, lng: -70.90393 },
  LA_ISLITA: { name: 'La Islita', lat: -33.74132, lng: -70.86256 },
  ALAMO_HUACHO: { name: 'Álamo Huacho', lat: -33.73414, lng: -70.86336 },
  SANTA_INES: { name: 'Santa Inés', lat: -33.7341, lng: -70.86122 },
  EL_MAITEN: { name: 'El Maitén', lat: -33.73553, lng: -70.86215 },

  // --- Chacabuco (Colina, Til Til) ---
  COLINA: { name: 'Colina', lat: -33.20247, lng: -70.67491 },
  ESMERALDA: { name: 'Esmeralda', lat: -33.18237, lng: -70.65032 },
  LIRAY: { name: 'Liray', lat: -33.25023, lng: -70.72761 },
  PELDEHUE: { name: 'Peldehue', lat: -33.13831, lng: -70.66257 },
  CHICUREO: { name: 'Chicureo', lat: -33.28365, lng: -70.65338 },
  PIEDRA_ROJA: { name: 'Piedra Roja', lat: -33.28007, lng: -70.6409 },
  CHAMISERO: { name: 'Chamisero', lat: -33.32183, lng: -70.64759 },
  TILTIL: { name: 'Til Til', lat: -33.08528, lng: -70.92939 },
  POLPAICO: { name: 'Polpaico', lat: -33.17062, lng: -70.88919 },
  PLAZUELA_POLPAICO: { name: 'Plazuela de Polpaico', lat: -33.15468, lng: -70.88696 },
  RUTA_5_LAMPA: { name: 'Ruta 5', lat: -33.32351, lng: -70.71952 },
  PANAMERICANA_NORTE: { name: 'Panamericana Norte', lat: -33.376, lng: -70.68 },
  METRO_VESPUCIO_NORTE: { name: 'EIM Vespucio Norte', lat: -33.38075, lng: -70.64634 },
  METRO_LOS_LIBERTADORES: { name: 'Metro Los Libertadores', lat: -33.36543, lng: -70.69199 },

  // --- Maipo (Paine, Buin) ---
  PAINE: { name: 'Paine', lat: -33.81011, lng: -70.73902 },
  BUIN: { name: 'Buin', lat: -33.73197, lng: -70.74196 },
  ALTO_JAHUEL: { name: 'Alto Jahuel', lat: -33.732, lng: -70.68432 },
  AUTOPISTA_CENTRAL: { name: 'Autopista Central', lat: -33.54098, lng: -70.68643 },
  HOSPITAL: { name: 'Hospital', lat: -33.86599, lng: -70.74697 },
  CHAMPA: { name: 'Champa', lat: -33.85485, lng: -70.76236 },
  HUELQUEN: { name: 'Huelquén', lat: -33.83264, lng: -70.64247 },
  CHADA: { name: 'Chada', lat: -33.90078, lng: -70.66087 },
  CULITRIN: { name: 'Culitrín', lat: -33.87446, lng: -70.68622 },
  EL_TRANSITO: { name: 'El Tránsito', lat: -33.78188, lng: -70.65907 },
  AGUILA_SUR: { name: 'Águila Sur', lat: -33.90493, lng: -70.7506 },
  LA_PALOMA: { name: 'La Paloma', lat: -33.80098, lng: -70.72451 },
  RANGUE: { name: 'Rangue', lat: -33.84434, lng: -70.95109 },
  PINTUE: { name: 'Pintué', lat: -33.87477, lng: -70.88156 },
  LAGUNA_ACULEO: { name: 'Laguna de Aculeo', lat: -33.85564, lng: -70.90295 },

  // --- Paraderos propios de Bupesa ---
  // El PDF de la empresa nombra estas villas pero no las ubica; no estan en
  // OpenStreetMap como lugar, asi que van a ojo dentro de Peñaflor.
  VICUNA: { name: 'Villa Vicuña, Peñaflor', lat: -33.6055, lng: -70.862 },
  PRADERAS: { name: 'Las Praderas, Peñaflor', lat: -33.6135, lng: -70.868 },
  MIRAFLORES: { name: 'Miraflores, Peñaflor', lat: -33.618, lng: -70.87 },
  SANTA_ROSA: { name: 'Terminal Santa Rosa', lat: -33.56, lng: -70.642 },
} satisfies Record<string, Waypoint>;

/** Tramo comun Peñaflor -> Santiago por Camino Melipilla. */
export const A_SANTIAGO: Waypoint[] = [
  WP.MALLOCO,
  WP.PADRE_HURTADO,
  WP.MAIPU,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

/** El mismo tramo tomando la Autopista del Sol: se salta Padre Hurtado y Maipú. */
export const A_SANTIAGO_EXPRESO: Waypoint[] = [
  WP.AUTOPISTA_SOL,
  WP.CERRILLOS,
  WP.ESTACION_CENTRAL,
  WP.TERMINAL_SAN_BORJA,
];

/** Tramo comun Paine -> Santiago por la Autopista Central. */
export const A_SANTIAGO_DESDE_PAINE: Waypoint[] = [
  WP.BUIN,
  WP.AUTOPISTA_CENTRAL,
  WP.METRO_PARQUE_OHIGGINS,
  WP.TERMINAL_SAN_BORJA,
];

/** El sentido de vuelta recorre los mismos puntos al reves. */
export const inverso = (stops: Waypoint[]): Waypoint[] => [...stops].reverse();

/** Azucar para escribir los horarios como vienen en la fuente: L-V | Sab | Dom. */
export const horarios = (
  weekday: [string, string],
  saturday?: [string, string],
  sunday?: [string, string],
): ScheduleSeed[] => {
  const [WEEKDAY, SATURDAY, SUNDAY] = DAY_TYPES;
  const out: ScheduleSeed[] = [
    { dayType: WEEKDAY, firstDeparture: weekday[0], lastDeparture: weekday[1] },
  ];
  if (saturday)
    out.push({ dayType: SATURDAY, firstDeparture: saturday[0], lastDeparture: saturday[1] });
  if (sunday) out.push({ dayType: SUNDAY, firstDeparture: sunday[0], lastDeparture: sunday[1] });
  return out;
};

/**
 * Tarifas por tipo de pasajero. El tipo que no se pasa NO genera fila: es la
 * diferencia entre "no lo publican" y "vale cero". Damir publica adulto y
 * estudiante pero no adulto mayor, y esa ausencia tiene que llegar a la base.
 */
export const tarifas = (montos: Partial<Record<(typeof PASSENGER_TYPES)[number], number>>) =>
  PASSENGER_TYPES.flatMap((passengerType): FareSeed[] => {
    const amountClp = montos[passengerType];
    return amountClp === undefined ? [] : [{ passengerType, amountClp }];
  });

/** Ninguna tarifa publicada. Explicito para que no se lea como un olvido. */
export const SIN_TARIFA_PUBLICADA: FareSeed[] = [];

/** La fuente no publica tabla de horarios. Explicito por la misma razon. */
export const SIN_HORARIO_PUBLICADO: ScheduleSeed[] = [];
