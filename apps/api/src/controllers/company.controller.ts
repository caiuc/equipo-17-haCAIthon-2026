import type { RequestHandler, Response } from 'express';
import type { CreateRouteInput, ReplaceStopsInput, UpdateRouteInput } from '@equipo17/shared';
import { companyIdOf } from '../middlewares/auth.js';
import { validatedBody, validatedParams } from '../middlewares/validate.js';
import * as routeService from '../services/route.service.js';
import * as driverService from '../services/driver.service.js';
import type { ScheduleInput } from '../services/route.service.js';

/**
 * Panel de la empresa. El companyId sale SIEMPRE del token (companyIdOf) y
 * nunca del body ni de la URL: es el aislamiento multitenant de §5.1.
 */

const idOf = (res: Response): string => validatedParams<{ id: string }>(res).id;

export const listRoutes: RequestHandler = async (req, res) => {
  res.json(await routeService.listRoutes(companyIdOf(req)));
};

export const createRoute: RequestHandler = async (req, res) => {
  const route = await routeService.createRoute(
    companyIdOf(req),
    validatedBody<CreateRouteInput>(req),
  );
  res.status(201).json(route);
};

export const getRoute: RequestHandler = async (req, res) => {
  res.json(await routeService.getRoute(companyIdOf(req), idOf(res)));
};

export const updateRoute: RequestHandler = async (req, res) => {
  const route = await routeService.updateRoute(
    companyIdOf(req),
    idOf(res),
    validatedBody<UpdateRouteInput>(req),
  );
  res.json(route);
};

export const deleteRoute: RequestHandler = async (req, res) => {
  await routeService.deleteRoute(companyIdOf(req), idOf(res));
  res.status(204).end();
};

export const replaceStops: RequestHandler = async (req, res) => {
  const { stops } = validatedBody<ReplaceStopsInput>(req);
  res.json(await routeService.replaceStops(companyIdOf(req), idOf(res), stops));
};

export const upsertSchedules: RequestHandler = async (req, res) => {
  const { schedules } = validatedBody<{ schedules: ScheduleInput[] }>(req);
  res.json(await routeService.upsertSchedules(companyIdOf(req), idOf(res), schedules));
};

export const listDrivers: RequestHandler = async (req, res) => {
  res.json(await driverService.listDrivers(companyIdOf(req)));
};

export const createDriver: RequestHandler = async (req, res) => {
  const driver = await driverService.createDriver(
    companyIdOf(req),
    validatedBody<driverService.CreateDriverInput>(req),
  );
  // 201 con la clave temporal en claro: unica vez que se muestra.
  res.status(201).json(driver);
};

export const updateDriver: RequestHandler = async (req, res) => {
  const driver = await driverService.updateDriver(
    companyIdOf(req),
    idOf(res),
    validatedBody<driverService.UpdateDriverInput>(req),
  );
  res.json(driver);
};

export const liveTrips: RequestHandler = async (req, res) => {
  const trips = await driverService.listLiveTrips(companyIdOf(req));
  // serverTime: el cliente calcula edades contra el reloj del servidor.
  res.json({ serverTime: new Date().toISOString(), trips });
};
