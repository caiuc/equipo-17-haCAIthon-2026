import { defineConfig } from 'tsup';

export default defineConfig({
  // Forma de objeto, no de array: con un array tsup deduciria un directorio base comun
  // entre src/ y prisma/ y emitiria dist/src/index.js, rompiendo el CMD del Dockerfile.
  // El seed se compila porque la imagen poda las devDependencies y ahi no sobrevive tsx.
  entry: {
    index: 'src/index.ts',
    // La clave se llama "seed" a proposito: docker-entrypoint.sh corre
    // dist/seed.js, y tsup nombra el bundle por la clave, no por el archivo.
    seed: 'prisma/seed/index.ts',
    // El simulador va en la misma imagen que el API: el servicio ECS
    // <prefijo>-simulator la reusa con command ["node","dist/simulate.js"].
    // Sin esta entrada la tarea muere en bucle, y cada reinicio quema cupo del
    // rate limit de login.
    simulate: 'tools/simulator/index.ts',
  },
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
