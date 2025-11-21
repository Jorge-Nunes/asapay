import { storage } from '../storage';
import { AsaasService } from './asaas.service';
import { EvolutionService } from './evolution.service';
import { ProcessorService } from './processor.service';
import type { Execution, ExecutionLog } from '@shared/schema';

export class ExecutionService {
  static async runExecution(): Promise<Execution> {
    const config = await storage.getConfig();

    console.log('[Execution] Config received:', {
      asaasToken: config.asaasToken ? `${config.asaasToken.substring(0, 10)}...` : 'EMPTY',
      evolutionUrl: config.evolutionUrl || 'EMPTY',
      evolutionApiKey: config.evolutionApiKey ? 'SET' : 'EMPTY',
      evolutionInstance: config.evolutionInstance || 'EMPTY',
    });

    // Validate config - ensure all required fields are present and not empty
    const asaasToken = (config.asaasToken || '').trim();
    const evolutionUrl = (config.evolutionUrl || '').trim();
    const evolutionApiKey = (config.evolutionApiKey || '').trim();
    const evolutionInstance = (config.evolutionInstance || '').trim();

    console.log('[Execution] After trim:', {
      asaasToken: asaasToken ? `${asaasToken.substring(0, 10)}...` : 'EMPTY',
      evolutionUrl: evolutionUrl ? evolutionUrl.substring(0, 20) : 'EMPTY',
      evolutionApiKey: evolutionApiKey ? 'SET' : 'EMPTY',
      evolutionInstance: evolutionInstance ? evolutionInstance : 'EMPTY',
    });

    if (!asaasToken || !evolutionUrl || !evolutionApiKey || !evolutionInstance) {
      console.error('[Execution] Config validation failed:', {
        hasAsaasToken: !!asaasToken,
        hasEvolutionUrl: !!evolutionUrl,
        hasEvolutionApiKey: !!evolutionApiKey,
        hasEvolutionInstance: !!evolutionInstance,
      });
      throw new Error('Configuração incompleta. Verifique se todas as credenciais foram configuradas: Token Asaas, URL da Evolution, API Key e Instância.');
    }

    // Create execution record
    const execution = await storage.createExecution({
      timestamp: new Date().toISOString(),
      status: 'running',
      cobrancasProcessadas: 0,
      mensagensEnviadas: 0,
      erros: 0,
      detalhes: [],
    });

    try {
      // Initialize services
      const asaasService = new AsaasService(config.asaasUrl, config.asaasToken);
      const evolutionService = new EvolutionService(
        config.evolutionUrl,
        config.evolutionApiKey,
        config.evolutionInstance
      );

      console.log('Fetching customers from Asaas...');
      const customers = await asaasService.getAllCustomers();

      console.log('Fetching pending payments from Asaas...');
      const payments = await asaasService.getPendingPayments();

      console.log('Enriching payments with customer data...');
      const cobrancas = await asaasService.enrichPaymentsWithCustomers(payments, customers);

      // Save cobrancas to storage
      await storage.saveCobrancas(cobrancas);

      console.log('Categorizing cobranças...');
      const categorized = ProcessorService.categorizeCobrancas(cobrancas, config.diasAviso);

      // Update cobrancas with tipo
      for (const cobranca of categorized) {
        await storage.updateCobranca(cobranca.id, { tipo: cobranca.tipo });
      }

      console.log('Processing messages...');
      const logs: ExecutionLog[] = [];
      
      const processedLogs = await ProcessorService.processCobrancasInBatches(
        categorized,
        config,
        evolutionService,
        (log) => {
          // Add log to execution in real-time
          logs.push(log as ExecutionLog);
        }
      );

      // Calculate metrics
      const mensagensEnviadas = processedLogs.filter(l => l.status === 'success').length;
      const erros = processedLogs.filter(l => l.status === 'error').length;

      // Update execution
      await storage.updateExecution(execution.id, {
        status: 'completed',
        cobrancasProcessadas: categorized.filter(c => c.tipo !== 'processada').length,
        mensagensEnviadas,
        erros,
        detalhes: processedLogs,
      });

      console.log(`Execution completed: ${mensagensEnviadas} messages sent, ${erros} errors`);

      return (await storage.getExecutionById(execution.id))!;
    } catch (error) {
      console.error('Execution failed:', error);
      
      await storage.updateExecution(execution.id, {
        status: 'failed',
        erros: 1,
      });

      throw error;
    }
  }
}
