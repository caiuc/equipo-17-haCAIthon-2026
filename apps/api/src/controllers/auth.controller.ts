import type { RequestHandler } from 'express';
import type { LoginInput, RegisterInput } from '@equipo17/shared';
import { validatedBody } from '../middlewares/validate.js';
import { HttpError } from '../middlewares/error.js';
import * as authService from '../services/auth.service.js';

export const register: RequestHandler = async (req, res) => {
  const result = await authService.registerPassenger(validatedBody<RegisterInput>(req));
  res.status(201).json(result);
};

export const login: RequestHandler = async (req, res) => {
  const result = await authService.login(validatedBody<LoginInput>(req));
  res.json(result);
};

export const me: RequestHandler = async (req, res) => {
  if (!req.auth) throw new HttpError(401, 'No autenticado');
  res.json(await authService.currentUser(req.auth.sub));
};
