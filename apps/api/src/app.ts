import express from 'express';
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
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '256kb' }));

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
