import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { 
  configurations, 
  cobrancas, 
  executions, 
  executionLogs,
  type Cobranca,
  type Execution,
  type ExecutionLog,
  type Config,
  type DashboardMetrics
} from "@shared/schema";
import type { IStorage } from "./storage";

let db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }
    const client = postgres(process.env.DATABASE_URL);
    db = drizzle(client);
  }
  return db;
}

export class PostgresStorage implements IStorage {
  async getConfig(): Promise<Config> {
    const db = getDb();
    const config = await db.query.configurations.findFirst();
    
    if (!config) {
      // Return default config
      return {
        asaasToken: process.env.ASAAS_TOKEN || '',
        asaasUrl: process.env.ASAAS_URL || 'https://api.asaas.com/v3',
        evolutionUrl: process.env.EVOLUTION_URL || '',
        evolutionInstance: process.env.EVOLUTION_INSTANCE || '',
        evolutionApiKey: process.env.EVOLUTION_APIKEY || '',
        diasAviso: 10,
        messageTemplates: {
          venceHoje: `🚗💨 Olá, aqui é da *TEKSAT Rastreamento Veicular*!
Notamos que sua fatura vence *hoje* 📅.
Para evitar juros e manter seu rastreamento ativo, faça o pagamento o quanto antes.

🔗 Link da fatura: {{link_fatura}}
💰 Valor: {{valor}}
📆 Vencimento: {{vencimento}}

Qualquer dúvida, nossa equipe está à disposição! 🤝`,
          aviso: `🔔 Olá, tudo bem? Somos da *TEKSAT Rastreamento Veicular*.
Faltam apenas {{dias_aviso}} dia(s) para o vencimento da sua fatura 🗓️.
Evite a suspensão do serviço e mantenha sua proteção ativa! 🛡️

🔗 Link da fatura: {{link_fatura}}
💰 Valor: {{valor}}
🗓️ Vencimento: {{vencimento}}

Estamos aqui para ajudar no que precisar! 📞`,
        },
      };
    }

    return {
      asaasToken: config.asaasToken,
      asaasUrl: config.asaasUrl,
      evolutionUrl: config.evolutionUrl,
      evolutionInstance: config.evolutionInstance,
      evolutionApiKey: config.evolutionApiKey,
      diasAviso: config.diasAviso,
      messageTemplates: config.messageTemplates as any,
    };
  }

  async updateConfig(config: Partial<Config>): Promise<Config> {
    const db = getDb();
    const existing = await db.query.configurations.findFirst();

    if (existing) {
      await db.update(configurations)
        .set({
          asaasToken: config.asaasToken ?? existing.asaasToken,
          asaasUrl: config.asaasUrl ?? existing.asaasUrl,
          evolutionUrl: config.evolutionUrl ?? existing.evolutionUrl,
          evolutionInstance: config.evolutionInstance ?? existing.evolutionInstance,
          evolutionApiKey: config.evolutionApiKey ?? existing.evolutionApiKey,
          diasAviso: config.diasAviso ?? existing.diasAviso,
          messageTemplates: config.messageTemplates ?? existing.messageTemplates,
          updatedAt: new Date(),
        })
        .where(eq(configurations.id, existing.id));
    } else {
      await db.insert(configurations).values({
        asaasToken: config.asaasToken || '',
        asaasUrl: config.asaasUrl || 'https://api.asaas.com/v3',
        evolutionUrl: config.evolutionUrl || '',
        evolutionInstance: config.evolutionInstance || '',
        evolutionApiKey: config.evolutionApiKey || '',
        diasAviso: config.diasAviso || 10,
        messageTemplates: config.messageTemplates || {
          venceHoje: '',
          aviso: '',
        },
      });
    }

    return this.getConfig();
  }

  async getCobrancas(): Promise<Cobranca[]> {
    const db = getDb();
    const result = await db.query.cobrancas.findMany();
    return result as Cobranca[];
  }

  async getCobrancaById(id: string): Promise<Cobranca | undefined> {
    const db = getDb();
    const result = await db.query.cobrancas.findFirst({
      where: eq(cobrancas.id, id),
    });
    return result as Cobranca | undefined;
  }

  async saveCobrancas(newCobrancas: Cobranca[]): Promise<void> {
    const db = getDb();
    
    for (const cobranca of newCobrancas) {
      const existing = await db.query.cobrancas.findFirst({
        where: eq(cobrancas.id, cobranca.id),
      });

      if (existing) {
        await db.update(cobrancas)
          .set({
            customer: cobranca.customer,
            customerName: cobranca.customerName,
            customerPhone: cobranca.customerPhone,
            value: cobranca.value.toString(),
            dueDate: cobranca.dueDate,
            status: cobranca.status,
            invoiceUrl: cobranca.invoiceUrl,
            description: cobranca.description,
            tipo: cobranca.tipo,
            updatedAt: new Date(),
          })
          .where(eq(cobrancas.id, cobranca.id));
      } else {
        await db.insert(cobrancas).values({
          id: cobranca.id,
          customer: cobranca.customer,
          customerName: cobranca.customerName,
          customerPhone: cobranca.customerPhone,
          value: cobranca.value.toString(),
          dueDate: cobranca.dueDate,
          status: cobranca.status,
          invoiceUrl: cobranca.invoiceUrl,
          description: cobranca.description,
          tipo: cobranca.tipo,
        });
      }
    }
  }

  async updateCobranca(id: string, data: Partial<Cobranca>): Promise<Cobranca | undefined> {
    const db = getDb();
    
    await db.update(cobrancas)
      .set({
        customer: data.customer,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        value: data.value?.toString(),
        dueDate: data.dueDate,
        status: data.status,
        invoiceUrl: data.invoiceUrl,
        description: data.description,
        tipo: data.tipo,
        updatedAt: new Date(),
      })
      .where(eq(cobrancas.id, id));

    return this.getCobrancaById(id);
  }

  async getExecutions(): Promise<Execution[]> {
    const db = getDb();
    const execs = await db.query.executions.findMany({
      orderBy: (table) => [table.timestamp],
    });

    const result: Execution[] = [];
    for (const exec of execs) {
      const logs = await db.query.executionLogs.findMany({
        where: eq(executionLogs.executionId, exec.id),
      });

      result.push({
        id: exec.id,
        timestamp: exec.timestamp!.toISOString(),
        status: exec.status as any,
        cobrancasProcessadas: exec.cobrancasProcessadas,
        mensagensEnviadas: exec.mensagensEnviadas,
        erros: exec.erros,
        detalhes: logs.map(l => ({
          id: l.id,
          cobrancaId: l.cobrancaId,
          customerName: l.customerName,
          customerPhone: l.customerPhone,
          tipo: l.tipo as any,
          status: l.status as any,
          mensagem: l.mensagem || undefined,
          erro: l.erro || undefined,
          timestamp: l.timestamp!.toISOString(),
        })),
      });
    }

    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getExecutionById(id: string): Promise<Execution | undefined> {
    const db = getDb();
    const exec = await db.query.executions.findFirst({
      where: eq(executions.id, id),
    });

    if (!exec) return undefined;

    const logs = await db.query.executionLogs.findMany({
      where: eq(executionLogs.executionId, id),
    });

    return {
      id: exec.id,
      timestamp: exec.timestamp!.toISOString(),
      status: exec.status as any,
      cobrancasProcessadas: exec.cobrancasProcessadas,
      mensagensEnviadas: exec.mensagensEnviadas,
      erros: exec.erros,
      detalhes: logs.map(l => ({
        id: l.id,
        cobrancaId: l.cobrancaId,
        customerName: l.customerName,
        customerPhone: l.customerPhone,
        tipo: l.tipo as any,
        status: l.status as any,
        mensagem: l.mensagem || undefined,
        erro: l.erro || undefined,
        timestamp: l.timestamp!.toISOString(),
      })),
    };
  }

  async createExecution(execution: Omit<Execution, 'id'>): Promise<Execution> {
    const db = getDb();
    const result = await db.insert(executions).values({
      timestamp: new Date(execution.timestamp),
      status: execution.status,
      cobrancasProcessadas: execution.cobrancasProcessadas,
      mensagensEnviadas: execution.mensagensEnviadas,
      erros: execution.erros,
    }).returning();

    return {
      id: result[0].id,
      timestamp: result[0].timestamp!.toISOString(),
      status: result[0].status as any,
      cobrancasProcessadas: result[0].cobrancasProcessadas,
      mensagensEnviadas: result[0].mensagensEnviadas,
      erros: result[0].erros,
      detalhes: [],
    };
  }

  async updateExecution(id: string, data: Partial<Execution>): Promise<Execution | undefined> {
    const db = getDb();
    
    await db.update(executions)
      .set({
        status: data.status,
        cobrancasProcessadas: data.cobrancasProcessadas,
        mensagensEnviadas: data.mensagensEnviadas,
        erros: data.erros,
      })
      .where(eq(executions.id, id));

    return this.getExecutionById(id);
  }

  async getExecutionLogs(executionId?: string): Promise<ExecutionLog[]> {
    const db = getDb();
    
    if (executionId) {
      const logs = await db.query.executionLogs.findMany({
        where: eq(executionLogs.executionId, executionId),
      });
      return logs.map(l => ({
        id: l.id,
        cobrancaId: l.cobrancaId,
        customerName: l.customerName,
        customerPhone: l.customerPhone,
        tipo: l.tipo as any,
        status: l.status as any,
        mensagem: l.mensagem || undefined,
        erro: l.erro || undefined,
        timestamp: l.timestamp!.toISOString(),
      }));
    }

    const logs = await db.query.executionLogs.findMany();
    return logs.map(l => ({
      id: l.id,
      cobrancaId: l.cobrancaId,
      customerName: l.customerName,
      customerPhone: l.customerPhone,
      tipo: l.tipo as any,
      status: l.status as any,
      mensagem: l.mensagem || undefined,
      erro: l.erro || undefined,
      timestamp: l.timestamp!.toISOString(),
    }));
  }

  async addExecutionLog(log: Omit<ExecutionLog, 'id'>): Promise<ExecutionLog> {
    const db = getDb();
    
    // Get the latest execution to use as executionId
    const latestExecution = await db.query.executions.findFirst({
      orderBy: (table) => [table.timestamp],
    });

    if (!latestExecution) {
      throw new Error("No execution found");
    }

    const result = await db.insert(executionLogs).values({
      executionId: latestExecution.id,
      cobrancaId: log.cobrancaId,
      customerName: log.customerName,
      customerPhone: log.customerPhone,
      tipo: log.tipo,
      status: log.status,
      mensagem: log.mensagem,
      erro: log.erro,
      timestamp: new Date(log.timestamp),
    }).returning();

    return {
      id: result[0].id,
      cobrancaId: result[0].cobrancaId,
      customerName: result[0].customerName,
      customerPhone: result[0].customerPhone,
      tipo: result[0].tipo as any,
      status: result[0].status as any,
      mensagem: result[0].mensagem || undefined,
      erro: result[0].erro || undefined,
      timestamp: result[0].timestamp!.toISOString(),
    };
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const db = getDb();
    const allCobrancas = await db.query.cobrancas.findMany();
    const pendentes = allCobrancas.filter(c => c.status === 'PENDING');
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const venceHoje = pendentes.filter(c => {
      const dueDate = new Date(c.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === hoje.getTime();
    }).length;

    const totalPendente = pendentes.reduce((sum, c) => sum + parseFloat(c.value as any), 0);

    const allLogs = await db.query.executionLogs.findMany();
    const mensagensEnviadas = allLogs.filter(l => l.status === 'success').length;

    const recebidas = allCobrancas.filter(c => c.status === 'RECEIVED' || c.status === 'CONFIRMED').length;
    const total = allCobrancas.length || 1;
    const taxaConversao = (recebidas / total) * 100;

    return {
      totalPendente,
      venceHoje,
      mensagensEnviadas,
      taxaConversao,
    };
  }
}
