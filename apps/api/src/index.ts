import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { hydrateLiveTrips } from './services/liveStore.js';

// Repuebla las micros en curso antes de aceptar trafico: un reinicio no debe
// dejarlas invisibles hasta su siguiente ping.
try {
  const recovered = await hydrateLiveTrips();
  if (recovered > 0) console.log(`Turnos activos recuperados: ${recovered}`);
} catch (error) {
  console.error('No se pudo recuperar el estado en vivo:', error);
}

const server = app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT}/api`);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
