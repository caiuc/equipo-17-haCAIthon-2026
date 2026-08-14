import type { RequestHandler } from 'express';
import type { CreateZoneInput } from '@equipo17/shared';
import { validatedBody, validatedParams } from '../middlewares/validate.js';
import * as regionService from '../services/region.service.js';

export const listRegions: RequestHandler = async (_req, res) => {
  res.json(await regionService.listRegions());
};

export const createZone: RequestHandler = async (req, res) => {
  const { regionId } = validatedParams<{ regionId: string }>(res);
  const zone = await regionService.findOrCreateZone(regionId, validatedBody<CreateZoneInput>(req));
  res.status(201).json(zone);
};
