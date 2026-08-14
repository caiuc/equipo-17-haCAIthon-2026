/**
 * Taxonomia region -> zona sembrada al inicio. Sin side effects, igual que el
 * resto de `data/`: el escritor (index.ts) es quien la sube a Postgres.
 *
 * Cubre las comunas donde efectivamente operan las 8 empresas rurales
 * sembradas, para que los selectores de filtro no arranquen vacios en la demo.
 * Nuevas zonas las puede crear cualquier empresa desde el panel — esto es solo
 * el punto de partida.
 *
 * `aliases` son localidades reales dentro de esa comuna que aparecen como
 * origin/destinationName en los recorridos sembrados (ej. "Chicureo" esta en
 * la comuna de Colina), para que el matcheo automatico de zona en index.ts
 * encuentre la comuna correcta sin tener que declarar `zoneId` a mano en cada
 * uno de los recorridos de las 8 empresas.
 */
export const REGIONS_SEED = [
  {
    name: 'Región Metropolitana',
    zones: [
      { name: 'Talagante', aliases: [] },
      { name: 'Peñaflor', aliases: [] },
      { name: 'El Monte', aliases: [] },
      { name: 'Isla de Maipo', aliases: ['Álamo Huacho'] },
      { name: 'Padre Hurtado', aliases: [] },
      {
        name: 'Paine',
        aliases: [
          'Laguna de Aculeo',
          'La Paloma',
          'Culitrín',
          'Aparcadero Municipal',
          'Terminal Rangue',
          'Terminal Los Arrieros',
          'Terminal Villorrio San Pascual',
          'Terminal El Tránsito',
          'Terminal Frida Kahlo',
        ],
      },
      { name: 'Colina', aliases: ['Chicureo', 'Esmeralda', 'Chamisero'] },
      { name: 'Til Til', aliases: [] },
      { name: 'Melipilla', aliases: [] },
      {
        name: 'Santiago',
        aliases: [
          'Terminal San Borja',
          'Estación Central',
          'EIM Vespucio Norte',
          'Metro Los Libertadores',
          'Bellavista de La Florida',
        ],
      },
    ],
  },
] as const;
