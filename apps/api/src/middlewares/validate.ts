import type { Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Valida y NORMALIZA el request con zod antes de que lo vea el controlador.
 * Es la defensa concreta contra inputs con caracteres especiales que pide §5.1:
 * lo que no calza con el schema nunca llega a la capa de servicios.
 *
 * Los ZodError los traduce el errorHandler a un 400 con detalle por campo.
 *
 * El body se reemplaza en sitio; query y params van a res.locals porque en
 * Express 5 req.query es un getter de solo lectura.
 */
export const validateBody =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };

export const validateQuery =
  (schema: ZodSchema): RequestHandler =>
  (req, res, next) => {
    res.locals.query = schema.parse(req.query);
    next();
  };

export const validateParams =
  (schema: ZodSchema): RequestHandler =>
  (req, res, next) => {
    res.locals.params = schema.parse(req.params);
    next();
  };

/** Lee lo que dejo validateQuery. */
export const validatedQuery = <T>(res: Response): T => res.locals.query as T;

/** Lee lo que dejo validateParams. */
export const validatedParams = <T>(res: Response): T => res.locals.params as T;

/** Azucar para leer el body ya parseado con su tipo. */
export const validatedBody = <T>(req: Request): T => req.body as T;
