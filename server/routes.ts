import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./index";
import { ExecutionService } from "./services/execution.service";
import { EvolutionService } from "./services/evolution.service";
import { ProcessorService } from "./services/processor.service";
import { AsaasService } from "./services/asaas.service";
import { WebhookService } from "./services/webhook.service";
import { TraccarService } from "./services/traccar.service";
import { setupCronJobs } from "./cron";
import bcrypt from "bcryptjs";
import { registerAuthRoutes } from "./routes/auth";
import { registerConfigRoutes } from "./routes/config";
import { registerCobrancasRoutes } from "./routes/cobrancas";

interface AuthRequest extends Request {
  userId?: string;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      req.userId = decoded.userId;
    } catch (e) {}
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  setupCronJobs();
  app.use(authMiddleware);

  // Register modular routes
  registerAuthRoutes(app);
  registerConfigRoutes(app);
  registerCobrancasRoutes(app);

  // TODO: Remove duplicated auth/config/cobrancas routes below and consolidate all remaining routes into /server/routes/*.ts files
  // Keeping original routes temporarily for compatibility during refactor

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./index";
import { ExecutionService } from "./services/execution.service";
import { EvolutionService } from "./services/evolution.service";
import { ProcessorService } from "./services/processor.service";
import { AsaasService } from "./services/asaas.service";
import { WebhookService } from "./services/webhook.service";
import { TraccarService } from "./services/traccar.service";
import { setupCronJobs } from "./cron";
import bcrypt from "bcryptjs";
import { registerAuthRoutes } from "./routes/auth";
import { registerConfigRoutes } from "./routes/config";
import { registerCobrancasRoutes } from "./routes/cobrancas";

interface AuthRequest extends Request {
  userId?: string;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      req.userId = decoded.userId;
    } catch (e) {}
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  setupCronJobs();
  app.use(authMiddleware);

  // Register modular routes
  registerAuthRoutes(app);
  registerConfigRoutes(app);
  registerCobrancasRoutes(app);

  // TODO: Remove duplicated auth/config/cobrancas routes below and consolidate all remaining routes into /server/routes/*.ts files
  // Keeping original routes temporarily for compatibility during refactor

