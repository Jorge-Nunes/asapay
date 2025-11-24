import { Express } from 'express';
import { registerAuthRoutes } from './auth';
import { registerConfigRoutes } from './config';
import { registerCobrancasRoutes } from './cobrancas';

export function registerModularRoutes(app: Express) {
  registerAuthRoutes(app);
  registerConfigRoutes(app);
  registerCobrancasRoutes(app);
}
