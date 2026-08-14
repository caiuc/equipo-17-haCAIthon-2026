import express from 'express';
import cors from 'cors';
import { corsOrigins } from './env.js';
import { healthRouter } from './routes/health.js';
import { itemsRouter } from './routes/items.js';
import { errorHandler, notFound } from './middleware/error.js';

/**
 * La app se exporta sin `listen` para que supertest la monte en memoria
 * (ver src/routes/items.test.ts). El arranque real vive en src/index.ts.
 */
export const app = express();

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', itemsRouter);

app.use(notFound);
app.use(errorHandler);
