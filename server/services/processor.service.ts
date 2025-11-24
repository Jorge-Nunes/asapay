import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Cobranca, ExecutionLog, Config, ClientData } from '@shared/schema';
import { EvolutionService } from './evolution.service';

interface ProcessedCobranca extends Cobranca {
  tipo: 'vence_hoje' | 'aviso' | 'atraso' | 'processada';
}

export class ProcessorService {
  static categorizeCobrancas(
    cobrancas: Cobranca[],
    diasAviso: number
  ): ProcessedCobranca[] {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return cobrancas.map(cobranca => {
      const dueDate = new Date(cobranca.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let tipo: 'vence_hoje' | 'aviso' | 'atraso' | 'processada';

      // Cobranças pagas/confirmadas nunca devem ser marcadas como atraso
      if (cobranca.status === 'RECEIVED' || cobranca.status === 'CONFIRMED') {
        tipo = 'processada';
      } else if (cobranca.status === 'OVERDUE' || diffDays < 0) {
        tipo = 'atraso';
      } else if (diffDays === 0) {
        tipo = 'vence_hoje';
      } else if (diffDays === diasAviso) {
        tipo = 'aviso';
      } else {
        tipo = 'processada';
      }

      return {
        ...cobranca,
        tipo,
      };
    });
  }

  static generateMessage(
    cobranca: ProcessedCobranca,
    template: string,
    diasAviso: number,
    overdueCount?: number,
    totalOverdueValue?: number
  ): string {
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cobranca.value);

    const vencimentoFormatado = format(
      new Date(cobranca.dueDate),
      'dd/MM/yyyy',
      { locale: ptBR }
    );

    const totalOverdueFormatted = totalOverdueValue
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(totalOverdueValue)
      : 'Consulte sua conta';

    return template
      .replace(/\{\{link_fatura\}\}/g, cobranca.invoiceUrl)
      .replace(/\{\{valor\}\}/g, valorFormatado)
      .replace(/\{\{vencimento\}\}/g, vencimentoFormatado)
      .replace(/\{\{cliente_nome\}\}/g, cobranca.customerName)
      .replace(/\{\{dias_aviso\}\}/g, String(diasAviso))
      .replace(/\{\{quantidade_cobrancas\}\}/g, String(overdueCount || 0))
      .replace(/\{\{valor_total\}\}/g, totalOverdueFormatted);
  }

  static async processCobrancasInBatches(
    cobrancas: ProcessedCobranca[],
    config: Config,
    evolutionService: EvolutionService,
    clientsMap?: Map<string, ClientData>,
    getLastMessageAtrasoDate?: (clientId: string) => Promise<Date | undefined>,
    recordMessageAtraso?: (clientId: string) => Promise<void>,
    onProgress?: (log: Omit<ExecutionLog, 'id'>) => void,
    hasCobrancaMessageBeenSentToday?: (cobrancaId: string) => Promise<boolean>,
    recordCobrancaMessageSent?: (cobrancaId: string) => Promise<void>
  ): Promise<ExecutionLog[]> {
    const logs: ExecutionLog[] = [];
    const batchSize = 10; // Process 10 at a time to avoid overwhelming the API

    // Filter only cobrancas that need messages
    const toProcess = cobrancas.filter(
      c => c.tipo === 'vence_hoje' || c.tipo === 'aviso' || c.tipo === 'atraso'
    );

    // Build a map of overdue counts and values per customer phone (for 'atraso' messages)
    const overdueCounts = new Map<string, { count: number; total: number }>();
    const overdueCobrancas = toProcess.filter(c => c.tipo === 'atraso');
    overdueCobrancas.forEach(cobranca => {
      const key = cobranca.customerPhone;
      if (!overdueCounts.has(key)) {
        overdueCounts.set(key, { count: 0, total: 0 });
      }
      const current = overdueCounts.get(key)!;
      current.count++;
      current.total += cobranca.value;
    });

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (cobranca) => {
        // Check if message was already sent to this cobranca today
        if (hasCobrancaMessageBeenSentToday) {
          const alreadySent = await hasCobrancaMessageBeenSentToday(cobranca.id);
          if (alreadySent) {
            const log: Omit<ExecutionLog, 'id'> = {
              cobrancaId: cobranca.id,
              customerName: cobranca.customerName,
              customerPhone: cobranca.customerPhone,
              tipo: cobranca.tipo as 'vence_hoje' | 'aviso' | 'atraso',
              status: 'error',
              timestamp: new Date().toISOString(),
              mensagem: 'Mensagem já foi enviada para esta cobrança hoje',
            };
            if (onProgress) {
              onProgress(log);
            }
            return log;
          }
        }
        // Check if we should send message for overdue invoices
        if (cobranca.tipo === 'atraso' && clientsMap) {
          // Find client by looking for matching customer phone in clients
          let clientData: ClientData | undefined;
          for (const client of clientsMap.values()) {
            if (client.mobilePhone === cobranca.customerPhone || client.phone === cobranca.customerPhone) {
              clientData = client;
              break;
            }
          }

          // Skip if client blocked daily messages
          if (clientData?.blockDailyMessages) {
            const log: Omit<ExecutionLog, 'id'> = {
              cobrancaId: cobranca.id,
              customerName: cobranca.customerName,
              customerPhone: cobranca.customerPhone,
              tipo: 'atraso',
              status: 'error',
              timestamp: new Date().toISOString(),
              mensagem: 'Cliente bloqueou mensagens de atraso',
            };
            if (onProgress) {
              onProgress(log);
            }
            return log;
          }

          // Check if enough days have passed since last overdue message
          if (clientData && getLastMessageAtrasoDate) {
            const lastMessageDate = await getLastMessageAtrasoDate(clientData.id);
            if (lastMessageDate) {
              const daysSinceLastMessage = Math.floor(
                (new Date().getTime() - new Date(lastMessageDate).getTime()) / (1000 * 60 * 60 * 24)
              );
              const intervalDays = clientData.diasAtrasoNotificacao || 3;

              if (daysSinceLastMessage < intervalDays) {
                const log: Omit<ExecutionLog, 'id'> = {
                  cobrancaId: cobranca.id,
                  customerName: cobranca.customerName,
                  customerPhone: cobranca.customerPhone,
                  tipo: 'atraso',
                  status: 'error',
                  timestamp: new Date().toISOString(),
                  mensagem: `Aguardando ${intervalDays - daysSinceLastMessage} dia(s) para próxima mensagem`,
                };
                if (onProgress) {
                  onProgress(log);
                }
                return log;
              }
            }
          }
        }

        // Validate phone number
        const isValidPhone = cobranca.customerPhone && /\d{10,}/.test(cobranca.customerPhone.replace(/\D/g, ''));

        const log: Omit<ExecutionLog, 'id'> = {
          cobrancaId: cobranca.id,
          customerName: cobranca.customerName,
          customerPhone: cobranca.customerPhone,
          tipo: cobranca.tipo as 'vence_hoje' | 'aviso' | 'atraso',
          status: 'success',
          timestamp: new Date().toISOString(),
        };

        // Skip if no valid phone number
        if (!isValidPhone) {
          log.status = 'error';
          log.erro = 'Telefone não informado ou inválido (mínimo 10 dígitos)';
          
          if (onProgress) {
            onProgress(log);
          }
          
          return log;
        }

        const template = 
          cobranca.tipo === 'vence_hoje'
            ? config.messageTemplates.venceHoje
            : cobranca.tipo === 'aviso'
            ? config.messageTemplates.aviso
            : config.messageTemplates.atraso;

        // For overdue messages, get the count and total value
        const overdueInfo = cobranca.tipo === 'atraso' 
          ? overdueCounts.get(cobranca.customerPhone)
          : undefined;

        const message = this.generateMessage(
          cobranca,
          template,
          config.diasAviso,
          overdueInfo?.count,
          overdueInfo?.total
        );

        try {
          await evolutionService.sendTextMessage(cobranca.customerPhone, message);
          log.mensagem = 'Mensagem enviada com sucesso';

          // Record that we sent a message for this cobranca
          if (recordCobrancaMessageSent) {
            await recordCobrancaMessageSent(cobranca.id);
          }

          // Record that we sent an overdue message for this client
          if (cobranca.tipo === 'atraso' && clientsMap && recordMessageAtraso) {
            let clientData: ClientData | undefined;
            for (const client of clientsMap.values()) {
              if (client.mobilePhone === cobranca.customerPhone || client.phone === cobranca.customerPhone) {
                clientData = client;
                break;
              }
            }
            if (clientData) {
              await recordMessageAtraso(clientData.id);
            }
          }
        } catch (error) {
          log.status = 'error';
          log.erro = error instanceof Error ? error.message : 'Erro desconhecido';
        }

        if (onProgress) {
          onProgress(log);
        }

        return log;
      });

      const batchResults = await Promise.all(batchPromises);
      logs.push(...(batchResults as ExecutionLog[]));

      // Small delay between batches
      if (i + batchSize < toProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return logs;
  }
}
