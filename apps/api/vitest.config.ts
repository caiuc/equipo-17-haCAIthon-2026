import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // tools/ tambien: la cinematica y el reparto de la flota del simulador son
    // funciones puras y se testean como cualquier otra.
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
