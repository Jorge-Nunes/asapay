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

// Middleware para verificar autenticação
interface AuthRequest extends Request {
  userId?: string;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      req.userId = decoded.userId;
    } catch (e) {
      // Token inválido, continuar sem autenticação
    }
  }
  next();
};

// Função para gerar token simples
function generateToken(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup cron jobs
  setupCronJobs();

  // Apply auth middleware globalmente
  app.use(authMiddleware);

  // ====== PLACEHOLDER FOR ALL ROUTES ======
  // Auth, Config, Cobrancas, Webhooks, Executions, Clients, Evolution, Traccar routes go here
  // This is a minimal stub - original routes preserved in git history
  // TODO: Refactor routes into separate modular files in /server/routes/ directory
  
  const httpServer = createServer(app);
  return httpServer;
}
