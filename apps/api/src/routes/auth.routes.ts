import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, registerSchema } from '@equipo17/shared';
import { isProduction } from '../config/env.js';
import { validateBody } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { login, me, register } from '../controllers/auth.controller.js';

export const authRouter = Router();

/**
 * Freno a la fuerza bruta contra credenciales (§5.1).
 *
 * El cupo NO se desactiva fuera de produccion (nada de `skip: () => !isProduction`):
 * apagar el limitador en dev y en tests dejaria pasar una regresion hasta
 * produccion sin que nadie la note.
 */
const AUTH_RATE_LIMIT = isProduction ? 30 : 300;

const windowMs = 15 * 60_000;
const mensajeDeCorte = { error: { message: 'Demasiados intentos, espera unos minutos' } };

/**
 * Limite del LOGIN: cuenta solo los intentos FALLIDOS.
 *
 * Parece que afloja la seguridad y es exactamente al reves. Lo que este
 * limitador tiene que frenar es la fuerza bruta, y la fuerza bruta se hace de
 * logins fallidos: con `skipSuccessfulRequests` un atacante sigue topando a los
 * 30 fallos por ventana, que es la proteccion que se queria. Lo que desaparece
 * es el dano colateral -- hoy CUALQUIERA puede gastar el cupo de una IP con 30
 * intentos y dejar afuera a todos los que comparten esa salida, o sea una
 * denegacion de servicio contra el login usando el propio freno como arma.
 *
 * Y es lo que desbloquea al simulador: sus 40 logins son todos correctos y
 * salen por UNA sola IP (la NAT de ECS). Contra el limitador viejo no cabian
 * nunca -- 40 pedidos contra un cupo de 30 -- y el 429 mataba la tarea, ECS la
 * reiniciaba, y cada reinicio quemaba mas cupo de una ventana ya agotada. El
 * mapa quedaba sin micros. Subir el numero a ciegas habria tapado eso aflojando
 * la proteccion de verdad; esto no la toca.
 */
const loginLimiter = rateLimit({
  windowMs,
  limit: AUTH_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: mensajeDeCorte,
});

/**
 * Limite del REGISTRO: cuenta todos los pedidos, tambien los exitosos.
 *
 * Aca `skipSuccessfulRequests` seria un error: en /register el pedido exitoso ES
 * el abuso (crear cuentas en masa), no la senal de que el cliente es legitimo.
 */
const registerLimiter = rateLimit({
  windowMs,
  limit: AUTH_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensajeDeCorte,
});

authRouter.post('/register', registerLimiter, validateBody(registerSchema), register);
authRouter.post('/login', loginLimiter, validateBody(loginSchema), login);
authRouter.get('/me', requireAuth, me);
