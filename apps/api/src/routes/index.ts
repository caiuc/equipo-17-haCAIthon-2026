import { Router } from 'express';
import { healthRouter } from './health.js';
import { docsRouter } from './docs.routes.js';
import { authRouter } from './auth.routes.js';
import { publicRouter } from './public.routes.js';
import { companyRouter } from './company.routes.js';
import { driverRouter } from './driver.routes.js';
import { tripsRouter } from './trips.routes.js';
import { adminRouter } from './admin.routes.js';

export const apiRouter = Router();

// Publico: el caso de uso real es alguien apurado en un paradero, sin cuenta.
apiRouter.use(healthRouter);
apiRouter.use(docsRouter);
apiRouter.use(publicRouter);
apiRouter.use(tripsRouter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/company', companyRouter);
apiRouter.use('/driver', driverRouter);
apiRouter.use('/admin', adminRouter);
