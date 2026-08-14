/**
 * El aviso de aproximacion vive aqui y en ningun otro lado: si cada archivo de
 * empresa repitiera su propia version, la primera que se editara dejaria a las
 * otras siete mintiendo.
 */
export const BANNER = `
┌────────────────────────────────────────────────────────────────────────────┐
│  QUE ES REAL Y QUE NO EN ESTE SEED                                         │
│                                                                            │
│  PARADEROS: aproximados. Las fuentes publican localidades y terminales,     │
│  no coordenadas. Los puntos son las localidades reales del corredor,        │
│  geocodificadas contra OpenStreetMap, y existen para que la demo tenga una  │
│  geometria coherente por donde mover las micros.                            │
│  Unica excepcion: MuniBus Paine, cuyos paraderos salen con GPS de la API    │
│  publica del operador (ver data/munibus.ts).                                │
│                                                                            │
│  PATENTES: INVENTADAS. Respetan el formato chileno de cuatro letras y dos   │
│  digitos, pero ninguna empresa publica su flota. No corresponden a ningun   │
│  vehiculo real.                                                             │
│                                                                            │
│  TARIFAS Y HORARIOS: solo los que la fuente publica. Ausencia de fila       │
│  significa "no publicado", nunca cero ni un horario supuesto. Cada empresa  │
│  lleva su propia sourceUrl y su propia sourceCheckedAt: la ficha de         │
│  Cobrexpress se consulto en abril de 2026 y las demas en agosto de 2026.    │
│                                                                            │
│  En produccion los paraderos NO se siembran: los carga cada empresa desde   │
│  su panel (PUT /api/company/routes/:id/stops). Eso es parte del diseno del  │
│  sistema, no una omision de este seed.                                      │
└────────────────────────────────────────────────────────────────────────────┘
`;
