import { Router } from 'express';
import { createCompanySchema, idParamSchema, updateCompanySchema } from '@equipo17/shared';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateBody, validateParams } from '../middlewares/validate.js';
import {
  createCompany,
  listCompanies,
  metrics,
  updateCompany,
} from '../controllers/admin.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('SUPERADMIN'));

adminRouter.get('/companies', listCompanies);
adminRouter.post('/companies', validateBody(createCompanySchema), createCompany);
adminRouter.patch(
  '/companies/:id',
  validateParams(idParamSchema),
  validateBody(updateCompanySchema),
  updateCompany,
);
adminRouter.get('/metrics', metrics);
