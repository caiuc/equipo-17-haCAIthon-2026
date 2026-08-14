import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Error de dominio con status HTTP explicito. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `Ruta no encontrada: ${req.method} ${req.path}` } });
};

// Express identifica el manejador de errores por su aridad de 4 argumentos,
// por eso `next` debe declararse aunque no se use.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: 'Datos invalidos', details: err.flatten().fieldErrors },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }

  // Registro completo en servidor, mensaje generico al cliente.
  console.error(err);
  res.status(500).json({ error: { message: 'Error interno del servidor' } });
};
