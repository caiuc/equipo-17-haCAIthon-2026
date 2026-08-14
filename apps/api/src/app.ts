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

// Detras del ALB: necesario para que el rate limit vea la IP real del cliente.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '256kb' }));

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);
