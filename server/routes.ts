import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./index";
import { ExecutionService } from "./services/execution.service";
import { EvolutionService } from "./services/evolution.service";
import { ProcessorService } from "./services/processor.service";
import { setupCronJobs } from "./cron";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup cron jobs
  setupCronJobs();

  // Config routes
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getConfig();
      // Return metadata showing which secrets are set
      res.json({
        ...config,
        asaasToken: config.asaasToken ? '••••••••' : '',
        evolutionApiKey: config.evolutionApiKey ? '••••••••' : '',
        _hasAsaasToken: !!config.asaasToken,
        _hasEvolutionApiKey: !!config.evolutionApiKey,
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
      updateData.evolutionUrl = req.body.evolutionUrl || currentConfig.evolutionUrl;
      updateData.evolutionInstance = req.body.evolutionInstance || currentConfig.evolutionInstance;
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
        _hasAsaasToken: !!updated.asaasToken,
        _hasEvolutionApiKey: !!updated.evolutionApiKey,
      });
    } catch (error) {
      console.error('[Routes] Error in updateConfig:', error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Cobranças routes
  app.get("/api/cobrancas", async (req, res) => {
    try {
      const { status, tipo } = req.query;
      let cobrancas = await storage.getCobrancas();

      if (status && status !== 'all') {
        cobrancas = cobrancas.filter(c => c.status === status);
      }

      if (tipo && tipo !== 'all') {
        cobrancas = cobrancas.filter(c => c.tipo === tipo);
      }

      res.json(cobrancas);
    } catch (error) {
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

      if (!config.messageTemplates?.venceHoje || !config.messageTemplates?.aviso) {
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
        : config.messageTemplates.aviso;

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

  // Executions routes
  app.get("/api/executions", async (req, res) => {
    try {
      const executions = await storage.getExecutions();
      res.json(executions);
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
        statusCounts[c.status]++;
      });

      const data = [
        { name: 'Pendente', value: statusCounts.PENDING },
        { name: 'Recebido', value: statusCounts.RECEIVED },
        { name: 'Confirmado', value: statusCounts.CONFIRMED },
        { name: 'Vencido', value: statusCounts.OVERDUE },
      ].filter(item => item.value > 0);

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch status data" });
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

      const user = await storage.createUser({ username, password, fullName, phone, address });
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

      const updated = await storage.updateUser(id, { username, password, fullName, phone, address });
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

  const httpServer = createServer(app);

  return httpServer;
}
