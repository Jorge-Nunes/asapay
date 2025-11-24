import { Express, Response } from 'express';
import { storage } from '../index';
import { sendError } from '../middleware/error-handler';

function maskSecrets(config: any) {
  return {
    ...config,
    asaasToken: config.asaasToken ? '••••••••' : '',
    evolutionApiKey: config.evolutionApiKey ? '••••••••' : '',
    traccarApiKey: config.traccarApiKey ? '••••••••' : '',
    traccarPassword: config.traccarPassword ? '••••••••' : '',
    _hasAsaasToken: !!config.asaasToken,
    _hasEvolutionApiKey: !!config.evolutionApiKey,
    _hasTraccarApiKey: !!config.traccarApiKey,
  };
}

function preserveSecrets(current: any, updated: any, fields: string[]) {
  fields.forEach(field => {
    if (updated[field] === '••••••••') {
      updated[field] = current[field];
    }
  });
}

export function registerConfigRoutes(app: Express) {
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getConfig();
      res.json(maskSecrets(config));
    } catch (error) {
      sendError(res, error, 'Config/Get');
    }
  });

  app.put("/api/config", async (req, res) => {
    try {
      const currentConfig = await storage.getConfig();
      const updateData: any = req.body;

      preserveSecrets(currentConfig, updateData, ['asaasToken', 'evolutionApiKey', 'traccarApiKey', 'traccarPassword']);

      if (!updateData.asaasToken?.trim()) return res.status(400).json({ error: "Token do Asaas é obrigatório" });
      if (!updateData.evolutionUrl?.trim()) return res.status(400).json({ error: "URL da Evolution API é obrigatória" });
      if (!updateData.evolutionApiKey?.trim()) return res.status(400).json({ error: "API Key da Evolution é obrigatória" });
      if (!updateData.evolutionInstance?.trim()) return res.status(400).json({ error: "Instância da Evolution é obrigatória" });

      const updated = await storage.updateConfig(updateData);
      res.json(maskSecrets(updated));
    } catch (error) {
      sendError(res, error, 'Config/Put');
    }
  });
}
