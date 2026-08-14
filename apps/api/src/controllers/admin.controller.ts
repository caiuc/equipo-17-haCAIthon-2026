import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { createCompanySchema, idParamSchema, updateCompanySchema } from '@equipo17/shared';
import { validatedBody, validatedParams } from '../middlewares/validate.js';
import * as adminService from '../services/admin.service.js';

type IdParam = z.infer<typeof idParamSchema>;

export const listCompanies: RequestHandler = async (_req, res) => {
  res.json(await adminService.listCompanies());
};

export const createCompany: RequestHandler = async (req, res) => {
  const created = await adminService.createCompany(
    validatedBody<z.infer<typeof createCompanySchema>>(req),
  );
  res.status(201).json(created);
};

export const updateCompany: RequestHandler = async (req, res) => {
  const { id } = validatedParams<IdParam>(res);
  const updated = await adminService.updateCompany(
    id,
    validatedBody<z.infer<typeof updateCompanySchema>>(req),
  );
  res.json(updated);
};

export const metrics: RequestHandler = async (_req, res) => {
  res.json(await adminService.metrics());
};
