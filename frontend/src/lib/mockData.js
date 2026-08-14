const now = Date.now()

// Zona rural ficticia para la demo — centro del mapa en la vista de pasajero.
export const RURAL_CENTER = { lat: -36.608, lng: -72.104 }

/**
 * Seed de empresas + micros en ruta, cada una con un estado de frescura
 * distinto (§4.5 del doc de requerimientos) para poder mostrar los 4 casos
 * en el mismo mockup. Los íconos de vehículo son placeholders hasta que
 * lleguen los assets 3D del equipo de diseño.
 */
export const MOCK_MICROS = [
  {
    id: "cordillera-r1",
    empresa: "Buses Cordillera",
    recorrido: "Rural 1 · El Sauce ↔ Terminal",
    tarifa: 700,
    horario: "Cada 45 min aprox.",
    capacidad: 32,
    position: { lat: -36.601, lng: -72.098 },
    lastSeenAt: now - 8 * 1000,
    turnoActivo: true,
    etaMin: 6,
  },
  {
    id: "losrios-r3",
    empresa: "Expreso Los Ríos",
    recorrido: "Rural 3 · La Vega ↔ Centro",
    tarifa: 650,
    horario: "Cada 1 hora aprox.",
    capacidad: 28,
    position: { lat: -36.615, lng: -72.112 },
    lastSeenAt: now - 3 * 60 * 1000,
    turnoActivo: true,
    etaMin: 14,
  },
  {
    id: "nuble-r5",
    empresa: "Trans Ñuble",
    recorrido: "Rural 5 · Confluencia ↔ Plaza",
    tarifa: 800,
    horario: "Cada 50 min aprox.",
    capacidad: 30,
    position: { lat: -36.598, lng: -72.115 },
    lastSeenAt: now - 12 * 60 * 1000,
    turnoActivo: true,
    etaMin: null,
  },
  {
    id: "valle-r2",
    empresa: "Buses del Valle",
    recorrido: "Rural 2 · Los Álamos ↔ Terminal",
    tarifa: 700,
    horario: "Cada 40 min aprox.",
    capacidad: 32,
    position: { lat: -36.612, lng: -72.09 },
    lastSeenAt: now - 90 * 60 * 1000,
    turnoActivo: false,
    etaMin: null,
  },
]
