import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Cobranca, ExecutionLog, Config } from '@shared/schema';
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

      if (cobranca.status === 'OVERDUE' || diffDays < 0) {
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
    diasAviso: number
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

    return template
      .replace(/\{\{link_fatura\}\}/g, cobranca.invoiceUrl)
      .replace(/\{\{valor\}\}/g, valorFormatado)
      .replace(/\{\{vencimento\}\}/g, vencimentoFormatado)
      .replace(/\{\{cliente_nome\}\}/g, cobranca.customerName)
      .replace(/\{\{dias_aviso\}\}/g, String(diasAviso));
  }

  static async processCobrancasInBatches(
    cobrancas: ProcessedCobranca[],
    config: Config,
    evolutionService: EvolutionService,
    onProgress?: (log: Omit<ExecutionLog, 'id'>) => void
  ): Promise<ExecutionLog[]> {
    const logs: ExecutionLog[] = [];
    const batchSize = 10; // Process 10 at a time to avoid overwhelming the API

    // Filter only cobrancas that need messages
    const toProcess = cobrancas.filter(
      c => c.tipo === 'vence_hoje' || c.tipo === 'aviso' || c.tipo === 'atraso'
    );

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (cobranca) => {
        const template = 
          cobranca.tipo === 'vence_hoje'
            ? config.messageTemplates.venceHoje
            : cobranca.tipo === 'aviso'
            ? config.messageTemplates.aviso
            : config.messageTemplates.atraso;

        const message = this.generateMessage(
          cobranca,
          template,
          config.diasAviso
        );

        const log: Omit<ExecutionLog, 'id'> = {
          cobrancaId: cobranca.id,
          customerName: cobranca.customerName,
          customerPhone: cobranca.customerPhone,
          tipo: cobranca.tipo as 'vence_hoje' | 'aviso' | 'atraso',
          status: 'success',
          timestamp: new Date().toISOString(),
        };

        try {
          await evolutionService.sendTextMessage(cobranca.customerPhone, message);
          log.mensagem = 'Mensagem enviada com sucesso';
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
