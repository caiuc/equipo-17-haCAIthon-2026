import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { corsOrigins } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFound } from './middlewares/error.js';

/**
 * La app se exporta sin `listen` para que supertest la monte en memoria.
 * El arranque real vive en src/index.ts.
 */
export const app = express();

// Cuantos proxies hay delante, para que el rate limit vea la IP real del cliente y no
// la del ultimo salto. En local 0, detras del ALB 1, detras de CloudFront + ALB 2: si
// se queda corto, todos los usuarios comparten el cupo de una misma IP de borde.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

app.use(helmet());

// Gzip antes de las rutas. GET /api/live/buses son ~70 KB de JSON con 200 micros y
// el mapa lo pide cada LIVE_POLL_INTERVAL_MS: sin comprimir, eso es casi un mega por
// minuto sobre la red movil rural que este proyecto existe para servir. Comprime ~8:1
// porque el payload son las mismas claves repetidas 200 veces.
// No se delega en CloudFront: alli la compresion al vuelo va atada al cacheo, y la
// behavior /api/* usa CachingDisabled a proposito (cachear posiciones seria mentir).
app.use(compression());

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '256kb' }));

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
