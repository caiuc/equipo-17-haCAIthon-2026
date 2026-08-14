import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Los paquetes del workspace se consumen como fuente TS, asi que hay que
  // inlinearlos: por defecto tsup externaliza todo lo que este en dependencies
  // y en runtime Node no sabria resolver @equipo17/shared.
  noExternal: [/^@equipo17\//],
  // Prisma si se resuelve en runtime desde node_modules (trae binarios nativos).
  external: ['@prisma/client', '.prisma/client'],
});
