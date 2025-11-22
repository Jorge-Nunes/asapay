import { storage } from '../index';
import { AsaasService } from './asaas.service';
import { EvolutionService } from './evolution.service';
import { ProcessorService } from './processor.service';
import { TraccarService } from './traccar.service';
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
      usuariosBloqueados: 0,
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

      console.log('Fetching clients for preference checking...');
      const clients = await storage.getClients();
      const clientsMap = new Map(clients.map(c => [c.id, c]));

      console.log('Processing messages...');
      const logs: ExecutionLog[] = [];
      
      console.log('[Execution] Starting processCobrancasInBatches with', categorized.length, 'cobrancas');
      const processedLogs = await ProcessorService.processCobrancasInBatches(
        categorized,
        config,
        evolutionService,
        clientsMap,
        (clientId) => storage.getClientLastMessageAtraso(clientId),
        (clientId) => storage.updateClientLastMessageAtraso(clientId),
        (log) => {
          // Add log to execution in real-time
          logs.push(log as ExecutionLog);
        },
        async (cobrancaId) => await storage.hasCobrancaMessageBeenSentToday(cobrancaId),
        async (cobrancaId) => await storage.recordCobrancaMessageSent(cobrancaId)
      );

      // Handle Traccar blocking logic
      if (config.traccarUrl && config.traccarApiKey) {
        console.log('Processing Traccar blocking for overdue customers...');
        try {
          const traccarService = new TraccarService(config);
          
          // Count overdue invoices per customer (by email and phone)
          const overdueByCustomer = new Map<string, number>();
          
          cobrancas.forEach(cobranca => {
            if (cobranca.status === 'OVERDUE') {
              // Use email/phone as identifier
              const key = `${cobranca.customerPhone}`;
              overdueByCustomer.set(key, (overdueByCustomer.get(key) || 0) + 1);
            }
          });

          const limiteCobrancas = config.traccarLimiteCobrancasVencidas || 3;
          
          // Process blocking/unblocking
          for (const [customerPhone, overdueCount] of overdueByCustomer.entries()) {
            try {
              // Try to find user by phone in Traccar
              const traccarUser = await traccarService.getUserByPhone(customerPhone);
              
              if (traccarUser) {
                const shouldBlock = overdueCount >= limiteCobrancas;
                const isCurrentlyBlocked = traccarUser.disabled === true;
                
                if (shouldBlock && !isCurrentlyBlocked) {
                  // Block user
                  console.log(`[Traccar] Bloqueando usuário ${customerPhone} - ${overdueCount} cobranças vencidas`);
                  await traccarService.blockUser(traccarUser.id);
                  
                  // Send blocking message
                  try {
                    if (config.messageTemplates?.bloqueio) {
                      const blockingMessage = config.messageTemplates.bloqueio
                        .replace(/\{\{cliente_nome\}\}/g, traccarUser.name || customerPhone)
                        .replace(/\{\{quantidade_cobrancas\}\}/g, String(overdueCount))
                        .replace(/\{\{link_fatura\}\}/g, 'Acesse sua conta no Asaas')
                        .replace(/\{\{valor_total\}\}/g, 'Consulte sua conta');
                      
                      await evolutionService.sendTextMessage(customerPhone, blockingMessage);
                      
                      logs.push({
                        id: `traccar-${traccarUser.id}-blocked`,
                        cobrancaId: 'N/A',
                        customerName: traccarUser.name || customerPhone,
                        customerPhone,
                        tipo: 'atraso',
                        status: 'success',
                        timestamp: new Date().toISOString(),
                        mensagem: `Usuário bloqueado no Traccar (${overdueCount}/${limiteCobrancas} cobranças vencidas) - Mensagem de bloqueio enviada`,
                      } as ExecutionLog);
                    }
                  } catch (error) {
                    console.error(`[Traccar] Erro ao enviar mensagem de bloqueio para ${customerPhone}:`, error);
                    logs.push({
                      id: `traccar-${traccarUser.id}-blocked-msg-error`,
                      cobrancaId: 'N/A',
                      customerName: traccarUser.name || customerPhone,
                      customerPhone,
                      tipo: 'atraso',
                      status: 'success',
                      timestamp: new Date().toISOString(),
                      mensagem: `Usuário bloqueado no Traccar mas falha ao enviar mensagem: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
                    } as ExecutionLog);
                  }
                } else if (!shouldBlock && isCurrentlyBlocked) {
                  // Unblock user if they no longer meet the blocking criteria
                  console.log(`[Traccar] Desbloqueando usuário ${customerPhone}`);
                  await traccarService.unblockUser(traccarUser.id);
                  
                  // Send unblocking message
                  try {
                    if (config.messageTemplates?.desbloqueio) {
                      const unlockingMessage = config.messageTemplates.desbloqueio
                        .replace(/\{\{cliente_nome\}\}/g, traccarUser.name || customerPhone);
                      
                      await evolutionService.sendTextMessage(customerPhone, unlockingMessage);
                      
                      logs.push({
                        id: `traccar-${traccarUser.id}-unblocked`,
                        cobrancaId: 'N/A',
                        customerName: traccarUser.name || customerPhone,
                        customerPhone,
                        tipo: 'atraso',
                        status: 'success',
                        timestamp: new Date().toISOString(),
                        mensagem: `Usuário desbloqueado no Traccar (${overdueCount}/${limiteCobrancas} cobranças vencidas) - Mensagem de desbloqueio enviada`,
                      } as ExecutionLog);
                    }
                  } catch (error) {
                    console.error(`[Traccar] Erro ao enviar mensagem de desbloqueio para ${customerPhone}:`, error);
                    logs.push({
                      id: `traccar-${traccarUser.id}-unblocked-msg-error`,
                      cobrancaId: 'N/A',
                      customerName: traccarUser.name || customerPhone,
                      customerPhone,
                      tipo: 'atraso',
                      status: 'success',
                      timestamp: new Date().toISOString(),
                      mensagem: `Usuário desbloqueado no Traccar mas falha ao enviar mensagem: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
                    } as ExecutionLog);
                  }
                }
              }
            } catch (error) {
              console.error(`[Traccar] Erro ao processar bloqueio para ${customerPhone}:`, error);
              
              logs.push({
                id: `traccar-error-${customerPhone}`,
                cobrancaId: 'N/A',
                customerName: customerPhone,
                customerPhone,
                tipo: 'atraso',
                status: 'error',
                timestamp: new Date().toISOString(),
                erro: error instanceof Error ? error.message : 'Erro desconhecido ao processar Traccar',
              } as ExecutionLog);
            }
          }
        } catch (error) {
          console.error('[Traccar] Erro ao inicializar serviço:', error);
        }
      }

      // Calculate metrics
      const mensagensEnviadas = processedLogs.filter(l => l.status === 'success').length;
      const erros = processedLogs.filter(l => l.status === 'error').length;
      const usuariosBloqueados = logs.filter(l => l.id?.includes('blocked')).length;

      // Combine all logs
      const allLogs = [...processedLogs, ...logs];

      // Update execution with final data
      await storage.updateExecution(execution.id, {
        status: 'completed',
        cobrancasProcessadas: categorized.filter(c => c.tipo !== 'processada').length,
        mensagensEnviadas,
        usuariosBloqueados,
        erros,
        detalhes: allLogs,
      });

      console.log(`Execution completed: ${mensagensEnviadas} messages sent, ${usuariosBloqueados} users blocked/unblocked, ${erros} errors`);

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
