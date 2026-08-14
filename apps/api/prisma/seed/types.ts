/**
 * Formas de los datos sembrados. Deliberadamente sin Prisma: estos tipos los
 * consume `data/`, que es solo estructura y no puede arrastrar un PrismaClient
 * (ver la cabecera de data/index.ts).
 */
import type { AssetSlug, CompanyKind, DayType, PassengerType } from '@equipo17/shared';

export type Waypoint = { name: string; lat: number; lng: number };

export type ScheduleSeed = { dayType: DayType; firstDeparture: string; lastDeparture: string };

export type FareSeed = { passengerType: PassengerType; amountClp: number };

export type RouteSeed = {
  code: string;
  name: string;
  originName: string;
  destinationName: string;
  stops: Waypoint[];
  /** Vacio = la fuente no publica tabla de horarios. No se inventa una. */
  schedules: ScheduleSeed[];
  /**
   * Vacio = tarifa NO publicada, que no es lo mismo que gratis. Gratis es una
   * fila con amountClp 0 (MuniBus Paine). Nunca un `?? 0`.
   */
  fares: FareSeed[];
};

export type DriverSeed = { email: string; name: string; licenseNumber: string };

export type BusSeed = {
  /** Patente INVENTADA con formato chileno. Ninguna empresa publica su flota. */
  plate: string;
  seats: number | null;
  /** Override del sprite de la empresa. Normalmente null: el dibujo lo da la empresa. */
  assetSlug: AssetSlug | null;
};

export type CompanySeed = {
  /** Clave natural del upsert: el rut no sirve, solo una de las ocho lo publica. */
  slug: string;
  name: string;
  rut: string | null;
  kind: CompanyKind;
  color: string;
  assetSlug: AssetSlug;
  phone: string | null;
  website: string | null;
  sourceUrl: string | null;
  /** Fecha de consulta de la ficha, en ISO. Cada empresa lleva la suya. */
  sourceCheckedAt: string;
  adminName: string;
  drivers: DriverSeed[];
  buses: BusSeed[];
  routes: RouteSeed[];
};
