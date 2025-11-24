import { Express } from 'express';
import { storage } from '../index';
import { AsaasService } from '../services/asaas.service';
import { EvolutionService } from '../services/evolution.service';
import { ProcessorService } from '../services/processor.service';
import { sendError } from '../middleware/error-handler';

export function registerCobrancasRoutes(app: Express) {
  app.get("/api/cobrancas", async (req, res) => {
    try {
      const { status, tipo, limit = '10', offset = '0' } = req.query;
      const pageLimit = Math.min(parseInt(limit as string) || 10, 100);
      const pageOffset = Math.max(parseInt(offset as string) || 0, 0);
      
      const result = await storage.getCobrancasPaginated(
        { status: status as string, tipo: tipo as string },
        pageLimit, pageOffset
      );

      res.json({ data: result.data, total: result.total, limit: pageLimit, offset: pageOffset });
    } catch (error) {
      sendError(res, error, 'Cobrancas/Get');
    }
  });

  app.get("/api/cobrancas/:id", async (req, res) => {
    try {
      const cobranca = await storage.getCobrancaById(req.params.id);
      if (!cobranca) return res.status(404).json({ error: "Cobrança not found" });
      res.json(cobranca);
    } catch (error) {
      sendError(res, error, 'Cobrancas/GetId');
    }
  });

  app.post("/api/cobrancas/sync", async (req, res) => {
    try {
      const config = await storage.getConfig();
      if (!config.asaasToken) return res.status(400).json({ error: "Token do Asaas não configurado" });

      const asaasService = new AsaasService(config.asaasUrl, config.asaasToken);
      const existingPaymentIds = await asaasService.getAllPaymentIds();
      const removedCount = await storage.removeDeletedCobrancas(existingPaymentIds);

      const payments = await asaasService.getAllPayments();
      const customers = await asaasService.getAllCustomers();
      const cobrancas = await asaasService.enrichPaymentsWithCustomers(payments, customers);
      
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
      sendError(res, error, 'Cobrancas/Sync');
    }
  });

  app.post("/api/cobrancas/:id/send-message", async (req, res) => {
    try {
      const cobranca = await storage.getCobrancaById(req.params.id);
      if (!cobranca) return res.status(404).json({ error: "Cobrança not found" });

      const config = await storage.getConfig();
      if (!config.evolutionUrl || !config.evolutionApiKey || !config.evolutionInstance) {
        return res.status(400).json({ error: "Credenciais Evolution não configuradas" });
      }

      const evolutionService = new EvolutionService(config.evolutionUrl, config.evolutionApiKey, config.evolutionInstance);
      const phone = cobranca.customerPhone?.replace(/\D/g, '') || '';
      if (!phone) return res.status(400).json({ error: "Telefone do cliente não encontrado" });

      const template = cobranca.tipo === 'vence_hoje' 
        ? config.messageTemplates?.venceHoje 
        : cobranca.tipo === 'aviso' ? config.messageTemplates?.aviso : config.messageTemplates?.atraso;

      const message = ProcessorService.generateMessage(
        { ...cobranca, value: parseFloat(cobranca.value.toString()) },
        template || '',
        config.diasAviso
      );

      const success = await evolutionService.sendTextMessage(phone, message);
      res.json({ success, message: success ? 'Mensagem enviada com sucesso!' : 'Erro ao enviar mensagem' });
    } catch (error) {
      sendError(res, error, 'Cobrancas/SendMessage');
    }
  });
}
