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

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      const token = generateToken(user.id);
      res.json({ 
        token, 
        userId: user.id,
        username: user.username 
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, fullName, phone, address } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Usuário já existe" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        fullName: fullName || username,
        phone: phone || "",
        address: address || ""
      });

      const token = generateToken(newUser.id);
      res.json({ 
        token, 
        userId: newUser.id,
        username: newUser.username 
      });
    } catch (error) {
      console.error('[Auth] Register error:', error);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  // Consolidated Asaas webhook endpoint - accepts both /api/webhooks/asaas and /api/webhook/asaas
  const handleAsaasWebhook = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const signature = req.headers['asaas-signature'] || req.headers['x-asaas-signature'];

      console.log(`[Webhook] Recebido evento: ${payload.event}`, { id: payload.id });

      // Validate webhook signature
      const config = await storage.getConfig();
      const isValidSignature = WebhookService.validateWebhookSignature(
        payload,
        signature,
        config.asaasToken
      );

      if (!isValidSignature) {
        console.error('[Webhook] Webhook signature validation failed');
        return res.status(401).json({ error: "Webhook signature validation failed" });
      }

      // Process webhook using service
      const webhookService = new WebhookService();
      await webhookService.processAsaasWebhook(payload);

      res.json({ success: true, processed: true });
    } catch (error) {
      console.error('[Webhook] Erro ao processar webhook:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao processar webhook" });
    }
  };

  // Both endpoints use the same handler
  app.post("/api/webhooks/asaas", handleAsaasWebhook);
  app.post("/api/webhook/asaas", handleAsaasWebhook);

  // Config routes
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getConfig();
      // Return metadata showing which secrets are set
      res.json({
        ...config,
        asaasToken: config.asaasToken ? '••••••••' : '',
        evolutionApiKey: config.evolutionApiKey ? '••••••••' : '',
        traccarApiKey: config.traccarApiKey ? '••••••••' : '',
        _hasAsaasToken: !!config.asaasToken,
        _hasEvolutionApiKey: !!config.evolutionApiKey,
        _hasTraccarApiKey: !!config.traccarApiKey,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.put("/api/config", async (req, res) => {
    try {
      const currentConfig = await storage.getConfig();
      const updateData: any = {};

      // Preserve current values if masked or not provided
      updateData.asaasToken = (req.body.asaasToken && req.body.asaasToken !== '••••••••') 
        ? req.body.asaasToken 
        : currentConfig.asaasToken;
      updateData.evolutionApiKey = (req.body.evolutionApiKey && req.body.evolutionApiKey !== '••••••••') 
        ? req.body.evolutionApiKey 
        : currentConfig.evolutionApiKey;
      updateData.traccarApiKey = (req.body.traccarApiKey && req.body.traccarApiKey !== '••••••••') 
        ? req.body.traccarApiKey 
        : currentConfig.traccarApiKey;
      updateData.evolutionUrl = req.body.evolutionUrl || currentConfig.evolutionUrl;
      updateData.evolutionInstance = req.body.evolutionInstance || currentConfig.evolutionInstance;
      updateData.traccarUrl = req.body.traccarUrl || currentConfig.traccarUrl;
      updateData.traccarUsername = req.body.traccarUsername || currentConfig.traccarUsername;
      updateData.traccarPassword = (req.body.traccarPassword && req.body.traccarPassword !== '••••••••') 
        ? req.body.traccarPassword 
        : currentConfig.traccarPassword;
      updateData.traccarVersion = req.body.traccarVersion || currentConfig.traccarVersion;
      updateData.traccarLimiteCobrancasVencidas = req.body.traccarLimiteCobrancasVencidas || currentConfig.traccarLimiteCobrancasVencidas;
      updateData.webhookUrl = req.body.webhookUrl || currentConfig.webhookUrl;
      updateData.diasAviso = req.body.diasAviso || currentConfig.diasAviso;
      updateData.messageTemplates = req.body.messageTemplates || currentConfig.messageTemplates;
      updateData.asaasUrl = req.body.asaasUrl || currentConfig.asaasUrl;

      // Validate that all fields are now non-empty
      if (!updateData.asaasToken || updateData.asaasToken.trim() === '') {
        return res.status(400).json({ error: "Token do Asaas é obrigatório" });
      }
      if (!updateData.evolutionUrl || updateData.evolutionUrl.trim() === '') {
        return res.status(400).json({ error: "URL da Evolution API é obrigatória" });
      }
      if (!updateData.evolutionApiKey || updateData.evolutionApiKey.trim() === '') {
        return res.status(400).json({ error: "API Key da Evolution é obrigatória" });
      }
      if (!updateData.evolutionInstance || updateData.evolutionInstance.trim() === '') {
        return res.status(400).json({ error: "Instância da Evolution é obrigatória" });
      }

      const updated = await storage.updateConfig(updateData);
      res.json({
        ...updated,
        asaasToken: updated.asaasToken ? '••••••••' : '',
        evolutionApiKey: updated.evolutionApiKey ? '••••••••' : '',
        traccarApiKey: updated.traccarApiKey ? '••••••••' : '',
        traccarPassword: updated.traccarPassword ? '••••••••' : '',
        _hasAsaasToken: !!updated.asaasToken,
        _hasEvolutionApiKey: !!updated.evolutionApiKey,
        _hasTraccarApiKey: !!updated.traccarApiKey,
      });
    } catch (error) {
      console.error('[Routes] Error in updateConfig:', error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Test Traccar connection
  app.post("/api/traccar/test-connection", async (req, res) => {
    try {
      const config = await storage.getConfig();
      
      if (!config.traccarUrl) {
        return res.status(400).json({ 
          success: false,
          error: "URL do Traccar não configurada" 
        });
      }

      const traccarService = new TraccarService(config);
      
      try {
        // Try to get users to validate connection
        const users = await traccarService.getUsers();
        
        res.json({
          success: true,
          message: "Conexão com Traccar estabelecida com sucesso!",
          usersCount: users?.length || 0,
          version: config.traccarVersion,
          server: config.traccarUrl,
          username: config.traccarUsername,
        });
      } catch (traccarError: any) {
        console.error('[TraccarTest] Error connecting to Traccar:', traccarError);
        res.status(400).json({
          success: false,
          error: traccarError.message || "Falha ao conectar com Traccar",
          details: {
            version: config.traccarVersion,
            server: config.traccarUrl,
            username: config.traccarUsername,
          },
          hint: config.traccarVersion === '4.15' 
            ? "Verifique se o usuário e senha estão corretos para Traccar 4.15"
            : "Verifique se o Token de Acesso está correto"
        });
      }
    } catch (error) {
      console.error('[Routes] Error in test Traccar connection:', error);
      res.status(500).json({ 
        success: false,
        error: "Erro ao testar conexão" 
      });
    }
  });

  // Cobranças routes
  app.get("/api/cobrancas", async (req, res) => {
    try {
      const { status, tipo, limit = '10', offset = '0' } = req.query;
      const pageLimit = Math.min(parseInt(limit as string) || 10, 100);
      const pageOffset = Math.max(parseInt(offset as string) || 0, 0);
      
      const result = await storage.getCobrancasPaginated(
        { 
          status: status as string, 
          tipo: tipo as string 
        },
        pageLimit,
        pageOffset
      );

      res.json({
        data: result.data,
        total: result.total,
        limit: pageLimit,
        offset: pageOffset,
      });
    } catch (error) {
      console.error('[Routes] Error in GET /api/cobrancas:', error);
      res.status(500).json({ error: "Failed to fetch cobranças" });
    }
  });

  app.get("/api/cobrancas/:id", async (req, res) => {
    try {
      const cobranca = await storage.getCobrancaById(req.params.id);
      if (!cobranca) {
        return res.status(404).json({ error: "Cobrança not found" });
      }
      res.json(cobranca);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cobrança" });
    }
  });

  // Sync cobranças with deletion detection
  app.post("/api/cobrancas/sync", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.asaasToken) {
        return res.status(400).json({ error: "Token do Asaas não configurado" });
      }

      const asaasService = new AsaasService(config.asaasUrl, config.asaasToken);

      // Step 1: Get all payment IDs from Asaas
      console.log('[Sync Cobrancas] Obtendo todos os IDs de cobranças do Asaas...');
      const existingPaymentIds = await asaasService.getAllPaymentIds();
      console.log(`[Sync Cobrancas] Encontradas ${existingPaymentIds.length} cobranças no Asaas`);

      // Step 2: Remove cobranças deletadas localmente
      console.log('[Sync Cobrancas] Removendo cobranças deletadas...');
      const removedCount = await storage.removeDeletedCobrancas(existingPaymentIds);
      if (removedCount > 0) {
        console.log(`[Sync Cobrancas] ${removedCount} cobranças removidas do sistema local`);
      }

      // Step 3: Fetch and sync existing payments from ALL statuses
      console.log('[Sync Cobrancas] Buscando cobranças atualizadas de todos os status...');
      const payments = await asaasService.getAllPayments();
      const customers = await asaasService.getAllCustomers();
      const cobrancas = await asaasService.enrichPaymentsWithCustomers(payments, customers);
      
      console.log(`[Sync Cobrancas] Sincronizando ${cobrancas.length} cobranças...`);
      await storage.saveCobrancas(cobrancas);
      await storage.updateSyncTimestamp('cobrancas');

      res.json({
        success: true,
        message: `Sincronização concluída: ${cobrancas.length} cobranças sincronizadas${removedCount > 0 ? `, ${removedCount} removidas` : ''}`,
        totalCobrancas: cobrancas.length,
        removedCobrancas: removedCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Routes] Error in cobrancas sync:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro na sincronização de cobranças" });
    }
  });

  // Send message for specific cobrança
  app.post("/api/cobrancas/:id/send-message", async (req, res) => {
    try {
      const cobranca = await storage.getCobrancaById(req.params.id);
      if (!cobranca) {
        return res.status(404).json({ error: "Cobrança not found" });
      }

      const config = await storage.getConfig();
      
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Credenciais Evolution não configuradas" });
      }

      if (!config.messageTemplates?.venceHoje || !config.messageTemplates?.aviso || !config.messageTemplates?.atraso) {
        return res.status(400).json({ error: "Templates de mensagem não configurados" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      // Format phone number (remove special characters)
      const phone = cobranca.customerPhone?.replace(/\D/g, '') || '';
      if (!phone) {
        return res.status(400).json({ error: "Telefone do cliente não encontrado" });
      }

      // Select template based on tipo
      const template = cobranca.tipo === 'vence_hoje' 
        ? config.messageTemplates.venceHoje 
        : cobranca.tipo === 'aviso'
        ? config.messageTemplates.aviso
        : config.messageTemplates.atraso;

      // Generate message using template
      const processedCobranca = {
        ...cobranca,
        value: parseFloat(cobranca.value.toString()),
      };
      
      const message = ProcessorService.generateMessage(
        processedCobranca,
        template,
        config.diasAviso
      );

      const success = await evolutionService.sendTextMessage(phone, message);

      res.json({ 
        success, 
        message: success ? 'Mensagem enviada com sucesso!' : 'Erro ao enviar mensagem' 
      });
    } catch (error) {
      console.error('[Routes] Error in send cobrança message:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao enviar mensagem" });
    }
  });

  // Block/Unblock client in Traccar
  app.post("/api/clients/:id/block-traccar", async (req, res) => {
    try {
      const client = await storage.getClients().then(clients => clients.find(c => c.id === req.params.id));
      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      if (!client.traccarUserId) {
        return res.status(400).json({ error: "Cliente não possui mapeamento Traccar" });
      }

      const config = await storage.getConfig();
      if (!config.traccarUrl || !config.traccarApiKey) {
        return res.status(400).json({ error: "Traccar não configurado" });
      }

      const traccarService = new TraccarService(config);
      
      // Block user in Traccar
      await traccarService.blockUser(parseInt(client.traccarUserId));
      
      // Update database
      await storage.blockClientTraccar(client.id);

      // Send blocking message if template exists
      if (config.messageTemplates?.bloqueio && config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
        try {
          const evolutionService = new EvolutionService(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.evolutionInstance
          );

          const phone = client.mobilePhone || client.phone || '';
          console.log('[Routes] Block message - Phone:', phone, 'Template:', !!config.messageTemplates.bloqueio);
          if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            console.log('[Routes] Cleaned phone:', cleanPhone);
            const message = config.messageTemplates.bloqueio
              .replace('{{nome}}', client.name)
              .replace('{{data}}', new Date().toLocaleDateString('pt-BR'));
            
            console.log('[Routes] Sending blocking message to:', cleanPhone);
            const result = await evolutionService.sendTextMessage(cleanPhone, message);
            console.log('[Routes] Blocking message sent:', result);
          }
        } catch (error) {
          console.error('[Routes] Error sending blocking message:', error);
        }
      } else {
        console.log('[Routes] Blocking message not sent - Template missing or Evolution not configured', {
          hasTemplate: !!config.messageTemplates?.bloqueio,
          hasEvolutionUrl: !!config.evolutionUrl,
          hasEvolutionApiKey: !!config.evolutionApiKey,
          hasEvolutionInstance: !!config.evolutionInstance,
        });
      }

      res.json({ success: true, message: `${client.name} foi bloqueado na Traccar` });
    } catch (error) {
      console.error('[Routes] Error blocking client:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao bloquear cliente" });
    }
  });

  app.post("/api/clients/:id/unblock-traccar", async (req, res) => {
    try {
      const client = await storage.getClients().then(clients => clients.find(c => c.id === req.params.id));
      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      if (!client.traccarUserId) {
        return res.status(400).json({ error: "Cliente não possui mapeamento Traccar" });
      }

      const config = await storage.getConfig();
      if (!config.traccarUrl || !config.traccarApiKey) {
        return res.status(400).json({ error: "Traccar não configurado" });
      }

      const traccarService = new TraccarService(config);
      
      // Unblock user in Traccar
      await traccarService.unblockUser(parseInt(client.traccarUserId));
      
      // Update database
      await storage.unblockClientTraccar(client.id);

      // Send unblocking message if template exists
      if (config.messageTemplates?.desbloqueio && config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
        try {
          const evolutionService = new EvolutionService(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.evolutionInstance
          );

          const phone = client.mobilePhone || client.phone || '';
          console.log('[Routes] Unblock message - Phone:', phone, 'Template:', !!config.messageTemplates.desbloqueio);
          if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            console.log('[Routes] Cleaned phone:', cleanPhone);
            const message = config.messageTemplates.desbloqueio
              .replace('{{nome}}', client.name)
              .replace('{{data}}', new Date().toLocaleDateString('pt-BR'));
            
            console.log('[Routes] Sending unblocking message to:', cleanPhone);
            const result = await evolutionService.sendTextMessage(cleanPhone, message);
            console.log('[Routes] Unblocking message sent:', result);
          }
        } catch (error) {
          console.error('[Routes] Error sending unblocking message:', error);
        }
      } else {
        console.log('[Routes] Unblocking message not sent - Template missing or Evolution not configured', {
          hasTemplate: !!config.messageTemplates?.desbloqueio,
          hasEvolutionUrl: !!config.evolutionUrl,
          hasEvolutionApiKey: !!config.evolutionApiKey,
          hasEvolutionInstance: !!config.evolutionInstance,
        });
      }

      res.json({ success: true, message: `${client.name} foi desbloqueado na Traccar` });
    } catch (error) {
      console.error('[Routes] Error unblocking client:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao desbloquear cliente" });
    }
  });

  // Executions routes
  app.get("/api/executions", async (req, res) => {
    try {
      const executions = await storage.getExecutions();
      // Enrich with logs
      const enriched = executions.map(exec => ({
        ...exec,
        detalhes: exec.detalhes || []
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch executions" });
    }
  });

  app.get("/api/executions/:id", async (req, res) => {
    try {
      const execution = await storage.getExecutionById(req.params.id);
      if (!execution) {
        return res.status(404).json({ error: "Execution not found" });
      }
      res.json(execution);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch execution" });
    }
  });

  app.post("/api/executions/run", async (req, res) => {
    try {
      const execution = await ExecutionService.runExecution();
      res.json(execution);
    } catch (error) {
      console.error('Error running execution:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to run execution" 
      });
    }
  });

  // Endpoint para registrar webhook no Asaas automaticamente
  app.post("/api/webhook/register", async (req, res) => {
    try {
      const config = await storage.getConfig();
      
      if (!config.asaasToken || !config.asaasUrl) {
        return res.status(400).json({ error: "Token do Asaas não configurado" });
      }

      if (!config.webhookUrl) {
        return res.status(400).json({ error: "URL do webhook não configurada" });
      }

      console.log('[Webhook] Registrando webhook no Asaas...');

      // Register webhook in Asaas
      const response = await fetch(`${config.asaasUrl}/webhooks`, {
        method: 'POST',
        headers: {
          'access_token': config.asaasToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: config.webhookUrl,
          event: [
            'PAYMENT_CREATED',
            'PAYMENT_RECEIVED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_OVERDUE',
            'PAYMENT_DELETED',
          ],
          sendType: 'SEQUENTIALLY',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Webhook] Erro ao registrar webhook:', error);
        return res.status(response.status).json({ 
          error: "Erro ao registrar webhook no Asaas",
          details: error.message 
        });
      }

      const result = await response.json();
      console.log('[Webhook] Webhook registrado com sucesso:', result);

      res.json({
        success: true,
        message: "Webhook registrado com sucesso no Asaas",
        webhookId: result.id,
        webhookUrl: config.webhookUrl,
      });
    } catch (error) {
      console.error('[Webhook] Erro ao registrar webhook:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Erro ao registrar webhook" 
      });
    }
  });

  // Endpoint para listar webhooks registrados
  app.get("/api/webhook/list", async (req, res) => {
    try {
      const config = await storage.getConfig();
      
      if (!config.asaasToken || !config.asaasUrl) {
        return res.status(400).json({ error: "Token do Asaas não configurado" });
      }

      console.log('[Webhook] Listando webhooks do Asaas...');

      const response = await fetch(`${config.asaasUrl}/webhooks`, {
        headers: {
          'access_token': config.asaasToken,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ 
          error: "Erro ao listar webhooks",
          details: error.message 
        });
      }

      const result = await response.json();
      console.log('[Webhook] Webhooks listados:', result.data?.length || 0);

      res.json({
        success: true,
        webhooks: result.data || [],
        total: result.totalCount || 0,
      });
    } catch (error) {
      console.error('[Webhook] Erro ao listar webhooks:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Erro ao listar webhooks" 
      });
    }
  });

  // Execution logs routes
  app.get("/api/executions/:id/logs", async (req, res) => {
    try {
      const logs = await storage.getExecutionLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/dashboard/chart-data", async (req, res) => {
    try {
      const executions = await storage.getExecutions();
      
      // Get last 7 days of executions
      const last7Days = executions
        .slice(0, 7)
        .reverse()
        .map(exec => ({
          date: new Date(exec.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          mensagens: exec.mensagensEnviadas,
          erros: exec.erros,
        }));

      res.json(last7Days);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chart data" });
    }
  });

  app.get("/api/dashboard/status-data", async (req, res) => {
    try {
      const cobrancas = await storage.getCobrancas();
      
      const statusCounts = {
        PENDING: 0,
        RECEIVED: 0,
        CONFIRMED: 0,
        OVERDUE: 0,
      };

      cobrancas.forEach(c => {
        const status = c.status as keyof typeof statusCounts;
        if (status in statusCounts) {
          statusCounts[status]++;
        }
      });

      const data = [
        { name: 'Pendente', value: statusCounts.PENDING },
        { name: 'Recebido', value: statusCounts.RECEIVED },
        { name: 'Confirmado', value: statusCounts.CONFIRMED },
        { name: 'Vencido', value: statusCounts.OVERDUE },
      ];

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status data" });
    }
  });

  app.get("/api/dashboard/financial-summary", async (req, res) => {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const summary = await storage.getFinancialSummary(startDate, endDate);
      res.json(summary);
    } catch (error) {
      console.error('[Routes] Error in getFinancialSummary:', error);
      res.status(500).json({ error: "Failed to fetch financial summary" });
    }
  });

  // User Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      res.json({
        token: Buffer.from(user.id).toString('base64'),
        userId: user.id,
      });
    } catch (error) {
      console.error('[Routes] Error in login:', error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // User Management Routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { username, password, fullName, phone, address } = req.body;
      
      if (!username || !password || !fullName || !phone || !address) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Usuário já existe" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashedPassword, fullName, phone, address });
      res.status(201).json(user);
    } catch (error) {
      console.error('[Routes] Error in createUser:', error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, fullName, phone, address } = req.body;

      let updateData: any = { username, fullName, phone, address };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updated = await storage.updateUser(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error('[Routes] Error in updateUser:', error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error('[Routes] Error in deleteUser:', error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Clients Management Routes - With Pagination
  app.get("/api/clients", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = ((req.query.sortOrder as string) || 'asc').toLowerCase() as 'asc' | 'desc';

      let clients = await storage.getClients();

      // Sort by field
      clients.sort((a, b) => {
        let aVal: any = a[sortBy as keyof typeof a];
        let bVal: any = b[sortBy as keyof typeof b];

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
        }
        if (typeof bVal === 'string') {
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Calculate pagination
      const total = clients.length;
      const pages = Math.ceil(total / limit);
      const validPage = Math.min(page, Math.max(1, pages));
      const skip = (validPage - 1) * limit;
      const paginatedClients = clients.slice(skip, skip + limit);

      res.json({
        data: paginatedClients,
        pagination: {
          page: validPage,
          limit,
          total,
          pages,
          hasNextPage: validPage < pages,
          hasPreviousPage: validPage > 1,
        },
      });
    } catch (error) {
      console.error('[Routes] Error in getClients:', error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.put("/api/clients/:id/preferences", async (req, res) => {
    try {
      const { id } = req.params;
      const { blockDailyMessages, diasAtrasoNotificacao } = req.body;

      if (typeof blockDailyMessages !== 'boolean' || typeof diasAtrasoNotificacao !== 'number') {
        return res.status(400).json({ error: "blockDailyMessages deve ser boolean e diasAtrasoNotificacao deve ser número" });
      }

      if (diasAtrasoNotificacao < 1) {
        return res.status(400).json({ error: "diasAtrasoNotificacao deve ser no mínimo 1" });
      }

      await storage.updateClientPreferences(id, blockDailyMessages, diasAtrasoNotificacao);
      const clients = await storage.getClients();
      const updatedClient = clients.find(c => c.id === id);
      
      res.json({ 
        success: true, 
        message: "Preferências atualizadas com sucesso",
        client: updatedClient 
      });
    } catch (error) {
      console.error('[Routes] Error in updateClientPreferences:', error);
      res.status(500).json({ error: "Failed to update client preferences" });
    }
  });

  app.put("/api/clients/:id/traccar-mapping", async (req, res) => {
    try {
      const { id } = req.params;
      const { traccarUserId } = req.body;

      if (traccarUserId && typeof traccarUserId !== 'string') {
        return res.status(400).json({ error: "traccarUserId deve ser uma string ou nulo" });
      }

      await storage.updateClientTraccarMapping(id, traccarUserId || null);
      const clients = await storage.getClients();
      const updatedClient = clients.find(c => c.id === id);
      
      res.json({ 
        success: true, 
        message: "Mapeamento Traccar atualizado com sucesso",
        client: updatedClient 
      });
    } catch (error) {
      console.error('[Routes] Error in updateClientTraccarMapping:', error);
      res.status(500).json({ error: "Failed to update client traccar mapping" });
    }
  });

  // Incremental sync - fetch only updated clients since last sync
  app.post("/api/sync/incremental", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.asaasToken) {
        return res.status(400).json({ error: "Token do Asaas não configurado" });
      }

      const lastSyncTime = storage.getLastSyncTimestamp('clients');
      const asaasService = new AsaasService(config.asaasUrl, config.asaasToken);

      console.log(`[Sync Incremental] Iniciando desde ${new Date(lastSyncTime).toISOString()}`);

      // Fetch all customers from Asaas
      const asaasCustomers = await asaasService.getAllCustomers();

      if (!asaasCustomers || asaasCustomers.length === 0) {
        return res.json({
          success: true,
          message: "Nenhum cliente novo encontrado",
          count: 0,
          lastSyncTime: new Date(lastSyncTime).toISOString(),
        });
      }

      // Get Traccar users if configured
      let traccarUsers: any[] = [];
      if (config.traccarUrl && config.traccarApiKey) {
        try {
          const traccarService = new TraccarService(config);
          traccarUsers = await traccarService.getUsers();
        } catch (error) {
          console.error('[Sync] Erro ao buscar usuários Traccar:', error);
        }
      }

      // Helper function for Traccar mapping
      const findTraccarUser = (customer: any) => {
        if (!traccarUsers.length) return { userId: null, method: null };
        
        if (customer.email) {
          const userByEmail = traccarUsers.find(u => u.email === customer.email);
          if (userByEmail) return { userId: userByEmail.id?.toString(), method: 'email' };
        }

        const customerPhone = (customer.mobilePhone || customer.phone || '').replace(/\D/g, '');
        if (customerPhone) {
          const userByPhone = traccarUsers.find(u => {
            const userData = u.name || u.email || '';
            return userData.replace(/\D/g, '').includes(customerPhone) || 
                   customerPhone.includes(userData.replace(/\D/g, ''));
          });
          if (userByPhone) return { userId: userByPhone.id?.toString(), method: 'phone' };
        }

        return { userId: null, method: null };
      };

      // Transform and sync customers
      const clientsToSync = asaasCustomers.map(customer => {
        const mapped = findTraccarUser(customer);
        return {
          asaasCustomerId: customer.id,
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          mobilePhone: customer.mobilePhone || '',
          address: customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          postalCode: customer.postalCode || '',
          cpfCnpj: customer.cpfCnpj || '',
          traccarUserId: mapped.userId,
          traccarMappingMethod: mapped.method,
        };
      });

      await storage.syncClients(clientsToSync);
      await storage.updateSyncTimestamp('clients');

      const mappedCount = clientsToSync.filter(c => c.traccarUserId).length;

      res.json({
        success: true,
        message: `Sincronização incremental concluída: ${clientsToSync.length} clientes atualizados`,
        count: clientsToSync.length,
        mapped: mappedCount,
        lastSyncTime: new Date(lastSyncTime).toISOString(),
        currentSyncTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Routes] Error in incremental sync:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro na sincronização incremental" });
    }
  });

  app.post("/api/clients/sync", async (req, res) => {
    try {
      const config = await storage.getConfig();

      if (!config.asaasToken) {
        return res.status(400).json({ error: "Token do Asaas não configurado" });
      }

      // Fetch customers from Asaas
      const asaasService = new AsaasService(config.asaasUrl, config.asaasToken);
      const asaasCustomers = await asaasService.getAllCustomers();

      if (!asaasCustomers || asaasCustomers.length === 0) {
        return res.status(400).json({ error: "Nenhum cliente encontrado no Asaas" });
      }

      // Fetch Traccar users for auto-mapping if configured
      let traccarUsers: any[] = [];
      console.log('[Sync] Verificando Traccar config:', { 
        traccarUrl: config.traccarUrl ? '✓ Configurado' : '✗ Não configurado',
        traccarApiKey: config.traccarApiKey ? '✓ Configurado' : '✗ Não configurado'
      });

      if (config.traccarUrl && config.traccarApiKey) {
        try {
          console.log('[Sync] Iniciando busca de usuários Traccar...');
          const traccarService = new TraccarService(config);
          traccarUsers = await traccarService.getUsers();
          console.log(`[Sync] Encontrados ${traccarUsers.length} usuários Traccar`);
          
          // Log first few users for debugging
          if (traccarUsers.length > 0) {
            console.log('[Sync] Primeiros usuários Traccar:', traccarUsers.slice(0, 3).map(u => ({ id: u.id, email: u.email, name: u.name })));
          }
        } catch (error) {
          console.error('[Sync] Erro ao buscar usuários Traccar:', error instanceof Error ? error.message : String(error));
        }
      } else {
        console.warn('[Sync] Traccar não está configurado - pulando auto-mapeamento');
      }

      // Function to find matching Traccar user by email or phone (returns { userId, method })
      const findTraccarUser = (customer: any) => {
        if (!traccarUsers.length) return { userId: null, method: null };

        // Try to match by email first
        if (customer.email) {
          const userByEmail = traccarUsers.find(u => u.email === customer.email);
          if (userByEmail) {
            console.log(`[Sync] Mapeamento encontrado por email: ${customer.email} → ${userByEmail.id}`);
            return { userId: userByEmail.id?.toString(), method: 'email' };
          }
        }

        // Try to match by phone (clean numbers)
        const customerPhone = (customer.mobilePhone || customer.phone || '').replace(/\D/g, '');
        if (customerPhone) {
          const userByPhone = traccarUsers.find(u => {
            const userData = u.name || u.email || '';
            return userData.replace(/\D/g, '').includes(customerPhone) || 
                   customerPhone.includes(userData.replace(/\D/g, ''));
          });
          if (userByPhone) {
            console.log(`[Sync] Mapeamento encontrado por telefone: ${customerPhone} → ${userByPhone.id}`);
            return { userId: userByPhone.id?.toString(), method: 'phone' };
          }
        }

        return { userId: null, method: null };
      };

      // Transform Asaas customers to our InsertClient format with Traccar mapping
      const clientsToSync = asaasCustomers.map(customer => {
        const mapped = findTraccarUser(customer);
        return {
          asaasCustomerId: customer.id,
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          mobilePhone: customer.mobilePhone || '',
          address: customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          postalCode: customer.postalCode || '',
          cpfCnpj: customer.cpfCnpj || '',
          traccarUserId: mapped.userId,
          traccarMappingMethod: mapped.method,
        };
      });

      // Sync clients to storage
      await storage.syncClients(clientsToSync);

      // Count successfully mapped clients
      const mappedCount = clientsToSync.filter(c => c.traccarUserId).length;

      res.json({
        success: true,
        message: `${clientsToSync.length} clientes sincronizados com sucesso${mappedCount > 0 ? ` (${mappedCount} mapeados na Traccar)` : ''}`,
        count: clientsToSync.length,
        mapped: mappedCount,
        traccarConfigured: !!config.traccarUrl && !!config.traccarApiKey,
        traccarUsersFound: traccarUsers.length,
      });
    } catch (error) {
      console.error('[Routes] Error in syncClients:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync clients" });
    }
  });

  // Test Evolution API - Send test message
  app.post("/api/test/send-message", async (req, res) => {
    try {
      const { phone, message } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ error: "Telefone e mensagem são obrigatórios" });
      }

      const config = await storage.getConfig();
      
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Credenciais Evolution não configuradas" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      const success = await evolutionService.sendTextMessage(phone, message);
      
      res.json({ 
        success, 
        message: success ? 'Mensagem enviada com sucesso!' : 'Erro ao enviar mensagem' 
      });
    } catch (error) {
      console.error('[Routes] Error in test send message:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao enviar mensagem" });
    }
  });

  // Test all message templates with fictional data
  app.post("/api/test/template-test", async (req, res) => {
    try {
      const config = await storage.getConfig();
      const phone = "11999623179"; // Fixed number for testing
      
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Credenciais Evolution não configuradas" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      // Create fictional data
      const fictitiousData = {
        customerName: "João Silva",
        customerPhone: phone,
        value: 1500.00,
        totalValue: 4500.00,
        overdueCount: 3,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        invoiceUrl: "https://www.asaas.com/i/m2o8y54uw3tj4fw2",
      };

      // Format values
      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(fictitiousData.value);

      const totalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(fictitiousData.totalValue);

      const vencimentoFormatado = fictitiousData.dueDate.toLocaleDateString('pt-BR');
      const dataAtual = new Date().toLocaleDateString('pt-BR');

      // Test all templates
      const templates = [
        {
          name: '1️⃣ VENCE HOJE',
          key: 'venceHoje',
          template: config.messageTemplates?.venceHoje || '',
          replacements: {
            '{{link_fatura}}': fictitiousData.invoiceUrl,
            '{{ link_fatura }}': fictitiousData.invoiceUrl,
            '{{valor}}': valorFormatado,
            '{{ valor }}': valorFormatado,
            '{{vencimento}}': vencimentoFormatado,
            '{{ vencimento }}': vencimentoFormatado,
            '{{cliente_nome}}': fictitiousData.customerName,
            '{{ cliente_nome }}': fictitiousData.customerName,
            '{{dias_aviso}}': String(config.diasAviso || 10),
            '{{ dias_aviso }}': String(config.diasAviso || 10),
          }
        },
        {
          name: '2️⃣ AVISO ANTECIPADO',
          key: 'aviso',
          template: config.messageTemplates?.aviso || '',
          replacements: {
            '{{link_fatura}}': fictitiousData.invoiceUrl,
            '{{ link_fatura }}': fictitiousData.invoiceUrl,
            '{{valor}}': valorFormatado,
            '{{ valor }}': valorFormatado,
            '{{vencimento}}': vencimentoFormatado,
            '{{ vencimento }}': vencimentoFormatado,
            '{{cliente_nome}}': fictitiousData.customerName,
            '{{ cliente_nome }}': fictitiousData.customerName,
            '{{dias_aviso}}': String(config.diasAviso || 10),
            '{{ dias_aviso }}': String(config.diasAviso || 10),
          }
        },
        {
          name: '3️⃣ COBRANÇA COM ATRASO',
          key: 'atraso',
          template: config.messageTemplates?.atraso || '',
          replacements: {
            '{{link_fatura}}': fictitiousData.invoiceUrl,
            '{{ link_fatura }}': fictitiousData.invoiceUrl,
            '{{valor}}': valorFormatado,
            '{{ valor }}': valorFormatado,
            '{{valor_total}}': totalFormatado,
            '{{ valor_total }}': totalFormatado,
            '{{quantidade_cobrancas}}': String(fictitiousData.overdueCount),
            '{{ quantidade_cobrancas }}': String(fictitiousData.overdueCount),
            '{{cliente_nome}}': fictitiousData.customerName,
            '{{ cliente_nome }}': fictitiousData.customerName,
          }
        },
        {
          name: '4️⃣ BLOQUEIO ATIVADO',
          key: 'bloqueio',
          template: config.messageTemplates?.bloqueio || '',
          replacements: {
            '{{nome}}': fictitiousData.customerName,
            '{{data}}': dataAtual,
            '{{quantidade_cobrancas}}': String(fictitiousData.overdueCount),
            '{{valor_total}}': totalFormatado,
          }
        },
        {
          name: '5️⃣ BLOQUEIO REMOVIDO',
          key: 'desbloqueio',
          template: config.messageTemplates?.desbloqueio || '',
          replacements: {
            '{{nome}}': fictitiousData.customerName,
            '{{data}}': dataAtual,
          }
        },
        {
          name: '6️⃣ PAGAMENTO CONFIRMADO',
          key: 'pagamentoConfirmado',
          template: config.messageTemplates?.pagamentoConfirmado || '',
          replacements: {
            '{{cliente_nome}}': fictitiousData.customerName,
            '{{ cliente_nome }}': fictitiousData.customerName,
            '{{valor}}': valorFormatado,
            '{{ valor }}': valorFormatado,
            '{{data}}': dataAtual,
            '{{ data }}': dataAtual,
          }
        },
      ];

      const results = [];

      // Send each template as a test message
      for (const tmpl of templates) {
        if (!tmpl.template || tmpl.template.trim() === '') {
          results.push({
            name: tmpl.name,
            status: 'skipped',
            error: 'Template vazio',
          });
          continue;
        }

        let message = tmpl.template;
        // Replace all variables
        for (const [key, value] of Object.entries(tmpl.replacements)) {
          message = message.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        try {
          await evolutionService.sendTextMessage(phone, message);
          
          // Add header to message for better display
          const headerMessage = `\n\n*TESTE: ${tmpl.name}*`;
          
          results.push({
            name: tmpl.name,
            status: 'sent',
            preview: message.substring(0, 100) + '...',
            fullMessage: message,
          });
          
          console.log(`[Test] Template ${tmpl.key} enviado para ${phone}`);
          
          // Small delay between messages
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          results.push({
            name: tmpl.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          console.error(`[Test] Erro ao enviar template ${tmpl.key}:`, error);
        }
      }

      res.json({
        success: true,
        phone,
        message: `✅ Teste de templates concluído! ${results.filter(r => r.status === 'sent').length} mensagens enviadas para ${phone}`,
        results,
        fictitiousData,
      });
    } catch (error) {
      console.error('[Routes] Error in template test:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Erro ao testar templates" 
      });
    }
  });

  // Analyze Traccar mapping status
  app.get("/api/traccar/mapping-status", async (req, res) => {
    try {
      const clients = await storage.getClients();
      
      // Group clients by traccarUserId
      const mappingGroups = new Map<string | null, any[]>();
      
      clients.forEach(client => {
        const traccarId = client.traccarUserId;
        if (!mappingGroups.has(traccarId)) {
          mappingGroups.set(traccarId, []);
        }
        mappingGroups.get(traccarId)!.push({
          id: client.id,
          name: client.name,
          asaasCustomerId: client.asaasCustomerId,
          email: client.email,
          phone: client.phone,
          mobilePhone: client.mobilePhone,
        });
      });

      // Analyze mappings
      const analysis = {
        totalClients: clients.length,
        clientsWithMapping: clients.filter(c => c.traccarUserId).length,
        clientsWithoutMapping: clients.filter(c => !c.traccarUserId).length,
        duplicateMappings: Array.from(mappingGroups.entries())
          .filter(([traccarId, clientList]) => traccarId && clientList.length > 1)
          .map(([traccarId, clientList]) => ({
            traccarUserId: traccarId,
            clientCount: clientList.length,
            clients: clientList,
          })),
        invalidMappings: Array.from(mappingGroups.entries())
          .filter(([traccarId, clientList]) => traccarId && clientList.length === 1)
          .map(([traccarId, clientList]) => ({
            traccarUserId: traccarId,
            client: clientList[0],
          })),
      };

      res.json(analysis);
    } catch (error) {
      console.error('[Routes] Error in mapping-status:', error);
      res.status(500).json({ error: "Erro ao analisar mapeamentos" });
    }
  });

  // Clear duplicate Traccar mappings - keeps first, clears rest
  app.post("/api/traccar/clear-duplicate-mappings", async (req, res) => {
    try {
      const clients = await storage.getClients();
      
      // Group clients by traccarUserId
      const mappingGroups = new Map<string, any[]>();
      
      clients.forEach(client => {
        if (client.traccarUserId) {
          const traccarId = client.traccarUserId;
          if (!mappingGroups.has(traccarId)) {
            mappingGroups.set(traccarId, []);
          }
          mappingGroups.get(traccarId)!.push(client);
        }
      });

      // Find and clear duplicates
      let cleared = 0;
      for (const [traccarId, clientList] of mappingGroups.entries()) {
        if (clientList.length > 1) {
          // Keep first, clear the rest
          for (let i = 1; i < clientList.length; i++) {
            const clientToClear = clientList[i];
            await storage.updateClientTraccarMapping(clientToClear.id, null);
            cleared++;
            console.log(`[Routes] Cleared Traccar mapping for client ${clientToClear.name} (was pointing to ${traccarId})`);
          }
        }
      }

      res.json({
        success: true,
        message: `Limpeza concluída: ${cleared} mapeamentos duplicados removidos`,
        cleared,
      });
    } catch (error) {
      console.error('[Routes] Error in clear-duplicate-mappings:', error);
      res.status(500).json({ error: "Erro ao limpar mapeamentos" });
    }
  });

  // Auto-mapping routes
  app.get("/api/traccar/preview-mapping", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.traccarUrl || !config.traccarApiKey) {
        return res.status(400).json({ error: "Traccar não configurado" });
      }

      const traccarService = new TraccarService(config);
      const clients = await storage.getClients();

      // Find clients without mapping
      const unmappedClients = clients.filter(c => !c.traccarUserId);

      if (unmappedClients.length === 0) {
        return res.json({
          message: "Todos os clientes já estão mapeados",
          toMap: [],
          unmappable: [],
        });
      }

      const toMap = [];
      const unmappable = [];

      for (const client of unmappedClients) {
        let traccarUser = null;
        let matchMethod = null;

        // Try email first
        if (client.email) {
          try {
            const emailUsers = await traccarService.getUsers().then(users =>
              users.filter((u: any) => u.email === client.email)
            );
            if (emailUsers.length === 1) {
              traccarUser = emailUsers[0];
              matchMethod = "email";
            }
          } catch (e) {
            console.error(`[Preview] Error searching by email for ${client.name}:`, e);
          }
        }

        // Try mobile phone if email didn't work
        if (!traccarUser && client.mobilePhone) {
          try {
            const cleanPhone = client.mobilePhone.replace(/\D/g, '');
            const phoneUsers = await traccarService.getUsers().then(users =>
              users.filter((u: any) => {
                const userPhone = u.name?.replace(/\D/g, '') || '';
                return userPhone === cleanPhone;
              })
            );
            if (phoneUsers.length === 1) {
              traccarUser = phoneUsers[0];
              matchMethod = "phone";
            }
          } catch (e) {
            console.error(`[Preview] Error searching by phone for ${client.name}:`, e);
          }
        }

        if (traccarUser) {
          toMap.push({
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.email,
            clientPhone: client.mobilePhone,
            traccarUserId: traccarUser.id,
            traccarUserName: traccarUser.name,
            traccarUserEmail: traccarUser.email,
            matchMethod,
          });
        } else {
          unmappable.push({
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.email,
            clientPhone: client.mobilePhone,
            reason: "Sem correspondência única no Traccar",
          });
        }
      }

      res.json({
        summary: {
          total: unmappedClients.length,
          canMap: toMap.length,
          unmappable: unmappable.length,
        },
        toMap,
        unmappable,
      });
    } catch (error) {
      console.error('[Routes] Error in preview-mapping:', error);
      res.status(500).json({ error: "Erro ao gerar preview de mapeamento" });
    }
  });

  app.post("/api/traccar/auto-mapping", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.traccarUrl || !config.traccarApiKey) {
        return res.status(400).json({ error: "Traccar não configurado" });
      }

      const traccarService = new TraccarService(config);
      const clients = await storage.getClients();

      // Find clients without mapping
      const unmappedClients = clients.filter(c => !c.traccarUserId);

      const mapped = [];
      const failed = [];

      for (const client of unmappedClients) {
        let traccarUser = null;
        let matchMethod = null;

        // Try email first
        if (client.email) {
          try {
            const emailUsers = await traccarService.getUsers().then(users =>
              users.filter((u: any) => u.email === client.email)
            );
            if (emailUsers.length === 1) {
              traccarUser = emailUsers[0];
              matchMethod = "email";
            }
          } catch (e) {
            console.error(`[AutoMapping] Error searching by email for ${client.name}:`, e);
          }
        }

        // Try mobile phone if email didn't work
        if (!traccarUser && client.mobilePhone) {
          try {
            const cleanPhone = client.mobilePhone.replace(/\D/g, '');
            const phoneUsers = await traccarService.getUsers().then(users =>
              users.filter((u: any) => {
                const userPhone = u.name?.replace(/\D/g, '') || '';
                return userPhone === cleanPhone;
              })
            );
            if (phoneUsers.length === 1) {
              traccarUser = phoneUsers[0];
              matchMethod = "phone";
            }
          } catch (e) {
            console.error(`[AutoMapping] Error searching by phone for ${client.name}:`, e);
          }
        }

        if (traccarUser) {
          try {
            await storage.updateClientTraccarMapping(client.id, String(traccarUser.id));
            // Update the mapping method using raw SQL
            await storage.updateClientMappingMethod(client.id, matchMethod);
            
            mapped.push({
              clientId: client.id,
              clientName: client.name,
              traccarUserId: traccarUser.id,
              traccarUserName: traccarUser.name,
              matchMethod,
            });
            console.log(`[AutoMapping] Mapped ${client.name} → Traccar ${traccarUser.id} (${matchMethod})`);
          } catch (e) {
            failed.push({
              clientId: client.id,
              clientName: client.name,
              reason: "Erro ao atualizar banco de dados",
            });
          }
        } else {
          failed.push({
            clientId: client.id,
            clientName: client.name,
            reason: "Sem correspondência única no Traccar",
          });
        }
      }

      res.json({
        summary: {
          total: unmappedClients.length,
          mapped: mapped.length,
          failed: failed.length,
        },
        mapped,
        failed,
      });
    } catch (error) {
      console.error('[Routes] Error in auto-mapping:', error);
      res.status(500).json({ error: "Erro ao executar mapeamento automático" });
    }
  });

  // Phone validation report - Check clients without valid phone numbers
  app.get("/api/reports/missing-phones", async (req, res) => {
    try {
      const clients = await storage.getClients();
      
      const withoutPhone = clients.filter(client => {
        const phone = client.mobilePhone || client.phone || '';
        const cleanedPhone = phone.replace(/\D/g, '');
        return !cleanedPhone || cleanedPhone.length < 10;
      });

      const withValidPhone = clients.filter(client => {
        const phone = client.mobilePhone || client.phone || '';
        const cleanedPhone = phone.replace(/\D/g, '');
        return cleanedPhone && cleanedPhone.length >= 10;
      });

      res.json({
        summary: {
          totalClients: clients.length,
          withValidPhone: withValidPhone.length,
          withoutPhone: withoutPhone.length,
          percentage: clients.length > 0 ? ((withoutPhone.length / clients.length) * 100).toFixed(2) + '%' : '0%',
        },
        withoutPhone: withoutPhone.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone || 'Vazio',
          mobilePhone: c.mobilePhone || 'Vazio',
        })),
      });
    } catch (error) {
      console.error('[Routes] Error in missing-phones report:', error);
      res.status(500).json({ error: "Erro ao gerar relatório" });
    }
  });

  // Load testing endpoints
  const { LoadTestService } = await import('./services/load-test.service.js');

  app.post("/api/test/load-test-data", async (req, res) => {
    try {
      const { clientsCount = 2000, cobrancasPerClient = 10 } = req.body;

      if (clientsCount > 10000) {
        return res.status(400).json({ error: "Máximo 10.000 clientes para teste" });
      }

      console.log(`[Routes] Starting load test: ${clientsCount} clients, ${cobrancasPerClient} cobrancas/client`);

      const result = await LoadTestService.insertTestData(storage, {
        clientsCount,
        cobrancasPerClient,
      });

      res.json({
        success: true,
        message: `Teste concluído com sucesso`,
        result,
        speedMetrics: {
          clientsPerSecond: (result.stats.totalClientsGenerated / (result.timing.insertionTime / 1000)).toFixed(2),
          cobrancasPerSecond: (result.stats.totalCobrancasGenerated / (result.timing.insertionTime / 1000)).toFixed(2),
          avgTimePerClient: (result.timing.insertionTime / result.stats.totalClientsGenerated).toFixed(2) + 'ms',
        },
      });
    } catch (error) {
      console.error('[Routes] Error in load-test-data:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao executar teste" });
    }
  });

  app.get("/api/test/performance-report", async (req, res) => {
    try {
      console.log(`[Routes] Generating performance report`);

      const perfResults = await LoadTestService.performanceTest(storage);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        performance: perfResults,
        recommendations: generateRecommendations(perfResults),
      });
    } catch (error) {
      console.error('[Routes] Error in performance-report:', error);
      res.status(500).json({ error: "Erro ao gerar relatório" });
    }
  });

  function generateRecommendations(perfResults: any): string[] {
    const recs = [];
    const avgQueryTime = perfResults.summary.avgQueryTime;

    if (avgQueryTime > 500) {
      recs.push("⚠️ Queries lentas (>500ms): Considere adicionar cache ou mais índices");
    } else if (avgQueryTime < 100) {
      recs.push("✅ Queries rápidas (<100ms): Índices estão otimizados");
    }

    if (perfResults.summary.totalCobrancas > 50000) {
      recs.push("💡 Muitas cobranças: Implemente paginação no frontend");
    }

    return recs;
  }

  // Evolution API endpoints
  app.get("/api/evolution/instance/status", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Evolution não configurada" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      const status = await evolutionService.getInstanceStatus();
      res.json(status);
    } catch (error) {
      console.error('[Evolution] Error getting instance status:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao obter status" });
    }
  });

  app.get("/api/evolution/instance/qrcode", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey) {
        return res.status(400).json({ error: "Evolution não configurada" });
      }

      // Use instance from query param or fall back to config default
      const instanceName = (req.query.instance as string) || config.evolutionInstance;
      if (!instanceName) {
        return res.status(400).json({ error: "Nenhuma instância especificada" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        instanceName
      );

      // First, check current instance status
      let status = await evolutionService.getInstanceStatus();
      
      console.log('[Evolution] QR Code request for:', instanceName, '- Current status:', status.status);
      
      // If already connected, return success status instead of QR code
      if (status.status === 'open') {
        return res.json({ 
          status: 'open',
          message: "WhatsApp já está conectado e funcionando",
          connected: true
        });
      }

      // If in QR state, try to get the QR code
      if (status.status === 'qr' && status.qrCode) {
        console.log('[Evolution] Got QR code from existing instance');
        return res.json({ 
          qrCode: status.qrCode, 
          message: "QR code gerado. Escaneie para conectar." 
        });
      }

      // If instance doesn't exist on Evolution API, it needs to be connected via Evolution's own UI
      // We can't auto-create instances on Evolution API, so return a message
      console.log('[Evolution] Instance not found on Evolution API, returning helpful message');
      
      // Return message indicating the instance needs to be created/connected via Evolution
      res.status(400).json({ 
        error: "Esta instância ainda não está conectada ao Evolution API. Você precisa criar ou conectar a instância primeiro no painel do Evolution.",
        currentStatus: status.status,
        helpText: "1. Acesse o painel do Evolution\n2. Crie a instância com o mesmo nome\n3. Escaneie o QR code no seu celular\n4. Volte aqui e tente novamente"
      });
    } catch (error) {
      console.error('[Evolution] Error getting QR code:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao obter QR code" });
    }
  });

  app.post("/api/evolution/instance/restart", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Evolution não configurada" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      const success = await evolutionService.restartInstance();
      if (success) {
        res.json({ success: true, message: "Instância reiniciada com sucesso" });
      } else {
        res.status(400).json({ error: "Falha ao reiniciar instância" });
      }
    } catch (error) {
      console.error('[Evolution] Error restarting instance:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao reiniciar" });
    }
  });

  app.post("/api/evolution/instance/stop", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Evolution não configurada" });
      }

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      const success = await evolutionService.stopInstance();
      if (success) {
        res.json({ success: true, message: "Instância parada com sucesso" });
      } else {
        res.status(400).json({ error: "Falha ao parar instância" });
      }
    } catch (error) {
      console.error('[Evolution] Error stopping instance:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao parar" });
    }
  });

  app.post("/api/evolution/instance/create", async (req, res) => {
    try {
      const { instanceName } = req.body;
      if (!instanceName) {
        return res.status(400).json({ error: "Nome da instância é obrigatório" });
      }

      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey) {
        return res.status(400).json({ error: "Evolution não configurada" });
      }

      // Create instance locally with status 'qr' (awaiting connection)
      // User will scan QR code to connect the instance
      await storage.createEvolutionInstance(
        instanceName,
        'qr',
        false,
        undefined
      );
      
      const instances = await storage.listEvolutionInstances();
      const createdInstance = instances.find((i: any) => i.name === instanceName);
      
      res.json(createdInstance || { name: instanceName, status: 'qr', connected: false });
    } catch (error) {
      console.error('[Evolution] Error creating instance:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Erro ao criar instância" });
    }
  });

  // New endpoint: Create and connect to instance in Evolution
  app.post("/api/evolution/instance/create-and-connect", async (req, res) => {
    try {
      const { instanceName } = req.body;
      if (!instanceName) {
        return res.status(400).json({ error: "Nome da instância é obrigatório" });
      }

      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey) {
        return res.status(400).json({ error: "Evolution não configurada" });
      }

      // Create instance locally
      await storage.createEvolutionInstance(
        instanceName,
        'qr',
        false,
        undefined
      );

      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        instanceName
      );

      console.log('[Evolution] Creating instance:', instanceName);
      
      // Try to create instance in Evolution
      let createdInstance;
      try {
        createdInstance = await evolutionService.createInstance(instanceName);
        console.log('[Evolution] Instance created, will fetch QR code next');
      } catch (createError: any) {
        console.log('[Evolution] Create failed:', createError.response?.status, createError.message);
        // If creation fails, might already exist, continue to fetch status
      }

      // Wait for instance to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch the actual status and QR code (with retries)
      let finalStatus = null;
      let finalQrCode = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts && !finalQrCode) {
        try {
          finalStatus = await evolutionService.getInstanceStatus();
          finalQrCode = await evolutionService.getQrCode();
          
          console.log('[Evolution] Got status after attempt', attempts + 1, {
            status: finalStatus?.status,
            hasQR: !!finalQrCode,
          });
          
          if (finalQrCode || finalStatus?.status === 'open') {
            break; // Got QR or already connected
          }
        } catch (error) {
          console.log('[Evolution] Error fetching status (attempt', attempts + 1, '):', error instanceof Error ? error.message : error);
        }

        attempts++;
        if (attempts < maxAttempts && !finalQrCode) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // If still no status, instance doesn't exist
      if (!finalStatus || finalStatus.status === 'unknown') {
        console.log('[Evolution] Instance not found after creation attempts');
        return res.status(400).json({
          error: 'Instância não encontrada na Evolution API.',
          message: 'Verifique se conseguiu criar. A instância deve estar ativa no painel do Evolution.',
        });
      }

      console.log('[Evolution] Instance ready:', {
        name: instanceName,
        status: finalStatus.status,
        hasQR: !!finalQrCode,
      });

      res.json({
        success: true,
        instance: finalStatus,
        message: finalStatus.status === 'open' 
          ? '✓ WhatsApp já está conectado!' 
          : 'Escaneie o QR code para conectar.',
        qrCode: finalQrCode || null,
      });
    } catch (error) {
      console.error('[Evolution] Error in create-and-connect:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Erro ao processar instância",
        message: 'Verifique a configuração da Evolution API.'
      });
    }
  });

  app.get("/api/evolution/instances", async (req, res) => {
    try {
      const instances = await storage.listEvolutionInstances();
      res.json(instances);
    } catch (error) {
      console.error('[Evolution] Error listing instances:', error);
      res.status(500).json({ error: "Erro ao listar instâncias" });
    }
  });

  app.put("/api/evolution/instances/:name/select", async (req, res) => {
    try {
      const { name } = req.params;
      const config = await storage.setActiveEvolutionInstance(name);
      res.json(config);
    } catch (error) {
      console.error('[Evolution] Error selecting instance:', error);
      res.status(500).json({ error: "Erro ao selecionar instância" });
    }
  });

  // Clear all data (except config) for fresh sync
  app.post("/api/clear-data", async (req, res) => {
    try {
      // Directly clear all Maps in storage - completely wipe everything
      const memStorage = storage as any;
      
      // Clear all data structures
      memStorage.cobrancas?.clear?.();
      memStorage.executions?.clear?.();
      memStorage.executionLogs = [];
      memStorage.clients?.clear?.();
      memStorage.clientLastMessageAtraso?.clear?.();
      memStorage.cobrancaLastMessageSent?.clear?.();
      
      console.log('[Routes] All data cleared successfully - maps wiped');
      res.json({ 
        success: true,
        message: "Todos os dados foram limpos. Configurações preservadas." 
      });
    } catch (error) {
      console.error('[Routes] Error clearing data:', error);
      res.status(500).json({ error: "Erro ao limpar dados", details: String(error) });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
