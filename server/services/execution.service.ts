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

      // ========== SYNC PHASE: Ensure all data is up-to-date ==========
      console.log('[Execution] 🔄 Iniciando sincronização completa de dados...');

      // Sync clientes with Traccar mapping
      console.log('[Execution] 👥 Sincronizando clientes do Asaas...');
      const asaasCustomers = await asaasService.getAllCustomers();
      
      // Get Traccar users for auto-mapping if configured
      let traccarUsers: any[] = [];
      if (config.traccarUrl && config.traccarApiKey) {
        try {
          const traccarService = new TraccarService(config);
          traccarUsers = await traccarService.getUsers();
          console.log(`[Execution] ✓ Encontrados ${traccarUsers.length} usuários Traccar`);
        } catch (error) {
          console.error('[Execution] Erro ao buscar usuários Traccar:', error);
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

      // Map customers with Traccar users
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
      console.log(`[Execution] ✓ ${clientsToSync.length} clientes sincronizados (${mappedCount} mapeados com Traccar)`);

      // Sync cobranças com TODOS os status (PENDING, RECEIVED, CONFIRMED, OVERDUE)
      console.log('[Execution] 📋 Sincronizando cobranças de todos os status...');
      const allPayments = await asaasService.getAllPayments();
      const customers = asaasCustomers;
      const cobrancasFromSync = await asaasService.enrichPaymentsWithCustomers(allPayments, customers);
      await storage.saveCobrancas(cobrancasFromSync);
      await storage.updateSyncTimestamp('cobrancas');
      console.log(`[Execution] ✓ ${cobrancasFromSync.length} cobranças sincronizadas`);

      // ========== PROCESSING PHASE: Now process the synchronized data ==========
      console.log('[Execution] 📤 Iniciando processamento de mensagens...');
      const cobrancas = cobrancasFromSync;

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
        (cobrancaId) => storage.hasCobrancaMessageBeenSentToday(cobrancaId),
        (cobrancaId) => storage.recordCobrancaMessageSent(cobrancaId)
      );

      // Handle Traccar blocking logic
      if (config.traccarUrl && config.traccarApiKey) {
        console.log('Processing Traccar blocking for overdue customers...');
        try {
          const traccarService = new TraccarService(config);
          
          // Count overdue invoices per customer (by asaasCustomerId)
          const overdueByAsaasId = new Map<string, { count: number; customerPhone: string }>();
          
          cobrancas.forEach(cobranca => {
            if (cobranca.status === 'OVERDUE') {
              // Use Asaas customer ID as identifier (unique)
              const current = overdueByAsaasId.get(cobranca.customer) || { count: 0, customerPhone: cobranca.customerPhone };
              overdueByAsaasId.set(cobranca.customer, {
                count: current.count + 1,
                customerPhone: cobranca.customerPhone
              });
            }
          });

          const limiteCobrancas = config.traccarLimiteCobrancasVencidas || 3;
          
          // Process blocking/unblocking
          for (const [asaasCustomerId, { count: overdueCount, customerPhone }] of overdueByAsaasId.entries()) {
            try {
              // Get client from Asaas ID to find Traccar mapping
              const client = await storage.getClientByAsaasId(asaasCustomerId);
              
              if (!client?.traccarUserId) {
                console.log(`[Traccar] Cliente ${asaasCustomerId} não tem usuário Traccar mapeado`);
                continue;
              }

              // Get user directly by ID (not by phone) - more reliable
              const traccarUser = await traccarService.getUserById(client.traccarUserId);
              
              if (traccarUser) {
                const shouldBlock = overdueCount >= limiteCobrancas;
                const isCurrentlyBlocked = traccarUser.disabled === true;
                
                if (shouldBlock && !isCurrentlyBlocked) {
                  // Block user
                  console.log(`[Traccar] Bloqueando usuário Traccar ID ${client.traccarUserId} (Cliente: ${asaasCustomerId}) - ${overdueCount} cobranças vencidas`);
                  await traccarService.blockUser(parseInt(client.traccarUserId));
                  
                  // Send blocking message
                  try {
                    if (config.messageTemplates?.bloqueio) {
                      const blockingMessage = config.messageTemplates.bloqueio
                        .replace(/\{\{nome\}\}/g, traccarUser.name || customerPhone)
                        .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
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
                  console.log(`[Traccar] Desbloqueando usuário Traccar ID ${client.traccarUserId} (Cliente: ${asaasCustomerId})`);
                  await traccarService.unblockUser(parseInt(client.traccarUserId));
                  
                  // Send unblocking message
                  try {
                    if (config.messageTemplates?.desbloqueio) {
                      const unlockingMessage = config.messageTemplates.desbloqueio
                        .replace(/\{\{nome\}\}/g, traccarUser.name || customerPhone)
                        .replace(/\{\{data\}\}/g, new Date().toLocaleDateString('pt-BR'))
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
