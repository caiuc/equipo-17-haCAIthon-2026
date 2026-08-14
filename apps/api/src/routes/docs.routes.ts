import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { HttpError } from '../middlewares/error.js';

/**
 * Sirve el contrato de la API para que el frontend apunte Swagger, Postman o un
 * generador de cliente directamente al servidor, sin tener que clonar el repo.
 *
 * El archivo se busca en dos sitios porque en desarrollo el codigo corre desde
 * src/ y en la imagen de produccion desde dist/, y en ambos casos openapi.yaml
 * vive en la raiz del paquete.
 */
export const docsRouter = Router();

const here = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  join(here, '../../openapi.yaml'), // dev:  src/routes -> apps/api
  join(here, '../openapi.yaml'), // build: dist -> apps/api
];

let cached: string | null = null;

const loadSpec = async (): Promise<string> => {
  if (cached) return cached;

  for (const path of CANDIDATES) {
    try {
      cached = await readFile(path, 'utf8');
      return cached;
    } catch {
      // Se prueba el siguiente candidato.
    }
  }

  throw new HttpError(404, 'El contrato de la API no esta disponible en este despliegue');
};

docsRouter.get('/openapi.yaml', async (_req, res) => {
  res.type('text/yaml').send(await loadSpec());
});
