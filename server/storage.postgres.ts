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
import * as schema from "@shared/schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }
    const client = postgres(process.env.DATABASE_URL);
    db = drizzle(client, { schema });
  }
  return db;
}

export class PostgresStorage implements IStorage {
  async getConfig(): Promise<Config> {
    try {
      const db = getDb();
      const config = await db.query.configurations.findFirst();
      
      const result = {
        asaasToken: config?.asaasToken || '',
        asaasUrl: config?.asaasUrl || 'https://api.asaas.com/v3',
        evolutionUrl: config?.evolutionUrl || '',
        evolutionInstance: config?.evolutionInstance || '',
        evolutionApiKey: config?.evolutionApiKey || '',
        traccarUrl: config?.traccarUrl || '',
        traccarApiKey: config?.traccarApiKey || '',
        traccarLimiteCobrancasVencidas: config?.traccarLimiteCobrancasVencidas || 3,
        webhookUrl: config?.webhookUrl || '',
        diasAviso: config?.diasAviso || 10,
        messageTemplates: (config?.messageTemplates as any) || {
          venceHoje: '',
          aviso: '',
          atraso: '',
        },
      };
      
      console.log('[Storage] Config result:', {
        asaasToken: result.asaasToken ? `${result.asaasToken.substring(0, 15)}...` : 'EMPTY',
        evolutionUrl: result.evolutionUrl ? result.evolutionUrl : 'EMPTY',
        evolutionApiKey: result.evolutionApiKey ? 'SET' : 'EMPTY',
        evolutionInstance: result.evolutionInstance ? result.evolutionInstance : 'EMPTY',
        traccarUrl: result.traccarUrl ? result.traccarUrl : 'EMPTY',
        traccarApiKey: result.traccarApiKey ? 'SET' : 'EMPTY',
      });

      return result;
    } catch (error) {
      console.error('[Storage] Error in getConfig:', error);
      throw error;
    }
  }

  async updateConfig(config: Partial<Config>): Promise<Config> {
    try {
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
            traccarUrl: config.traccarUrl ?? existing.traccarUrl,
            traccarApiKey: config.traccarApiKey ?? existing.traccarApiKey,
            traccarLimiteCobrancasVencidas: config.traccarLimiteCobrancasVencidas ?? existing.traccarLimiteCobrancasVencidas,
            webhookUrl: config.webhookUrl ?? existing.webhookUrl,
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
          traccarUrl: config.traccarUrl || '',
          traccarApiKey: config.traccarApiKey || '',
          traccarLimiteCobrancasVencidas: config.traccarLimiteCobrancasVencidas || 3,
          webhookUrl: config.webhookUrl || '',
          diasAviso: config.diasAviso || 10,
          messageTemplates: config.messageTemplates || {
            venceHoje: '',
            aviso: '',
            atraso: '',
          },
        });
      }

      return this.getConfig();
    } catch (error) {
      console.error('[Storage] Error in updateConfig:', error);
      throw error;
    }
  }

  async getCobrancas(): Promise<Cobranca[]> {
    try {
      const db = getDb();
      const result = await db.query.cobrancas.findMany();
      return result.map(r => ({
        id: r.id,
        customer: r.customer,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        value: parseFloat(r.value as any),
        dueDate: r.dueDate,
        status: r.status as any,
        invoiceUrl: r.invoiceUrl,
        description: r.description,
        tipo: r.tipo as any,
      }));
    } catch (error) {
      console.error('[Storage] Error in getCobrancas:', error);
      throw error;
    }
  }

  async getCobrancaById(id: string): Promise<Cobranca | undefined> {
    try {
      const db = getDb();
      const result = await db.query.cobrancas.findFirst({
        where: eq(cobrancas.id, id),
      });
      if (!result) return undefined;
      return {
        id: result.id,
        customer: result.customer,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        value: parseFloat(result.value as any),
        dueDate: result.dueDate,
        status: result.status as any,
        invoiceUrl: result.invoiceUrl,
        description: result.description,
        tipo: result.tipo as any,
      };
    } catch (error) {
      console.error('[Storage] Error in getCobrancaById:', error);
      throw error;
    }
  }

  async saveCobrancas(newCobrancas: Cobranca[]): Promise<void> {
    try {
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
    } catch (error) {
      console.error('[Storage] Error in saveCobrancas:', error);
      throw error;
    }
  }

  async updateCobranca(id: string, data: Partial<Cobranca>): Promise<Cobranca | undefined> {
    try {
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
    } catch (error) {
      console.error('[Storage] Error in updateCobranca:', error);
      throw error;
    }
  }

  async getExecutions(): Promise<Execution[]> {
    try {
      const db = getDb();
      const execs = await db.query.executions.findMany({
        orderBy: (table: any) => [table.timestamp],
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
          detalhes: logs.map((l: any) => ({
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
    } catch (error) {
      console.error('[Storage] Error in getExecutions:', error);
      throw error;
    }
  }

  async getExecutionById(id: string): Promise<Execution | undefined> {
    try {
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
        detalhes: logs.map((l: any) => ({
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
    } catch (error) {
      console.error('[Storage] Error in getExecutionById:', error);
      throw error;
    }
  }

  async createExecution(execution: Omit<Execution, 'id'>): Promise<Execution> {
    try {
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
    } catch (error) {
      console.error('[Storage] Error in createExecution:', error);
      throw error;
    }
  }

  async updateExecution(id: string, data: Partial<Execution>): Promise<Execution | undefined> {
    try {
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
    } catch (error) {
      console.error('[Storage] Error in updateExecution:', error);
      throw error;
    }
  }

  async getExecutionLogs(executionId?: string): Promise<ExecutionLog[]> {
    try {
      const db = getDb();
      
      if (executionId) {
        const logs = await db.query.executionLogs.findMany({
          where: eq(executionLogs.executionId, executionId),
        });
        return logs.map((l: any) => ({
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
      return logs.map((l: any) => ({
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
    } catch (error) {
      console.error('[Storage] Error in getExecutionLogs:', error);
      throw error;
    }
  }

  async addExecutionLog(log: Omit<ExecutionLog, 'id'>): Promise<ExecutionLog> {
    try {
      const db = getDb();
      
      const latestExecution = await db.query.executions.findFirst({
        orderBy: (table: any) => [table.timestamp],
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
    } catch (error) {
      console.error('[Storage] Error in addExecutionLog:', error);
      throw error;
    }
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const db = getDb();
      const allCobrancas = await db.query.cobrancas.findMany();
      const pendentes = allCobrancas.filter((c: any) => c.status === 'PENDING');
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const venceHoje = pendentes.filter((c: any) => {
        const dueDate = new Date(c.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === hoje.getTime();
      }).length;

      const totalPendente = pendentes.reduce((sum: number, c: any) => sum + parseFloat(c.value as any), 0);

      const allLogs = await db.query.executionLogs.findMany();
      const mensagensEnviadas = allLogs.filter((l: any) => l.status === 'success').length;

      const recebidas = allCobrancas.filter((c: any) => c.status === 'RECEIVED' || c.status === 'CONFIRMED').length;
      const total = allCobrancas.length || 1;
      const taxaConversao = (recebidas / total) * 100;

      return {
        totalPendente,
        venceHoje,
        mensagensEnviadas,
        taxaConversao,
      };
    } catch (error) {
      console.error('[Storage] Error in getDashboardMetrics:', error);
      throw error;
    }
  }

  async getUsers(): Promise<any[]> {
    try {
      const db = getDb();
      const result = await db.query.users.findMany();
      return result.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        phone: u.phone,
        address: u.address,
        createdAt: u.createdAt?.toISOString(),
      }));
    } catch (error) {
      console.error('[Storage] Error in getUsers:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<any | undefined> {
    try {
      const db = getDb();
      const result = await db.query.users.findFirst({
        where: eq(schema.users.id, id),
      });
      if (!result) return undefined;
      return {
        id: result.id,
        username: result.username,
        fullName: result.fullName,
        phone: result.phone,
        address: result.address,
        createdAt: result.createdAt?.toISOString(),
      };
    } catch (error) {
      console.error('[Storage] Error in getUserById:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<any | undefined> {
    try {
      const db = getDb();
      const result = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });
      return result;
    } catch (error) {
      console.error('[Storage] Error in getUserByUsername:', error);
      throw error;
    }
  }

  async createUser(user: { username: string; password: string; fullName: string; phone: string; address: string }): Promise<any> {
    try {
      const db = getDb();
      const result = await db.insert(schema.users).values({
        username: user.username,
        password: user.password,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
      }).returning();

      return {
        id: result[0].id,
        username: result[0].username,
        fullName: result[0].fullName,
        phone: result[0].phone,
        address: result[0].address,
        createdAt: result[0].createdAt?.toISOString(),
      };
    } catch (error) {
      console.error('[Storage] Error in createUser:', error);
      throw error;
    }
  }

  async updateUser(id: string, data: { username?: string; password?: string; fullName?: string; phone?: string; address?: string }): Promise<any | undefined> {
    try {
      const db = getDb();
      
      const updateData: any = {};
      if (data.username) updateData.username = data.username;
      if (data.password) updateData.password = data.password;
      if (data.fullName) updateData.fullName = data.fullName;
      if (data.phone) updateData.phone = data.phone;
      if (data.address) updateData.address = data.address;

      await db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id));

      return this.getUserById(id);
    } catch (error) {
      console.error('[Storage] Error in updateUser:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const db = getDb();
      await db.delete(schema.users).where(eq(schema.users.id, id));
    } catch (error) {
      console.error('[Storage] Error in deleteUser:', error);
      throw error;
    }
  }

  async getClients(): Promise<schema.ClientData[]> {
    try {
      const db = getDb();
      const result = await db.query.clients.findMany();
      return result as schema.ClientData[];
    } catch (error) {
      console.error('[Storage] Error in getClients:', error);
      throw error;
    }
  }

  async getClientByAsaasId(asaasCustomerId: string): Promise<schema.ClientData | undefined> {
    try {
      const db = getDb();
      const result = await db.query.clients.findFirst({
        where: eq(schema.clients.asaasCustomerId, asaasCustomerId),
      });
      return result as schema.ClientData | undefined;
    } catch (error) {
      console.error('[Storage] Error in getClientByAsaasId:', error);
      throw error;
    }
  }

  async syncClients(clients: schema.InsertClient[]): Promise<void> {
    try {
      const db = getDb();
      
      for (const client of clients) {
        const existing = await db.query.clients.findFirst({
          where: eq(schema.clients.asaasCustomerId, client.asaasCustomerId),
        });

        if (existing) {
          await db.update(schema.clients)
            .set({
              name: client.name,
              email: client.email,
              phone: client.phone,
              mobilePhone: client.mobilePhone,
              address: client.address,
              city: client.city,
              state: client.state,
              postalCode: client.postalCode,
              cpfCnpj: client.cpfCnpj,
              traccarUserId: client.traccarUserId ?? existing.traccarUserId,
              isTraccarBlocked: client.isTraccarBlocked ?? existing.isTraccarBlocked,
              updatedAt: new Date(),
            })
            .where(eq(schema.clients.asaasCustomerId, client.asaasCustomerId));
        } else {
          await db.insert(schema.clients).values({
            asaasCustomerId: client.asaasCustomerId,
            name: client.name,
            email: client.email,
            phone: client.phone,
            mobilePhone: client.mobilePhone,
            address: client.address,
            city: client.city,
            state: client.state,
            postalCode: client.postalCode,
            cpfCnpj: client.cpfCnpj,
            traccarUserId: client.traccarUserId || null,
            blockDailyMessages: 0,
            diasAtrasoNotificacao: 3,
            isTraccarBlocked: 0,
          });
        }
      }
    } catch (error) {
      console.error('[Storage] Error in syncClients:', error);
      throw error;
    }
  }

  async updateClientPreferences(clientId: string, blockDailyMessages: boolean, diasAtrasoNotificacao: number): Promise<void> {
    try {
      const db = getDb();
      await db.update(schema.clients)
        .set({
          blockDailyMessages: blockDailyMessages ? 1 : 0,
          diasAtrasoNotificacao,
          updatedAt: new Date(),
        })
        .where(eq(schema.clients.id, clientId));
    } catch (error) {
      console.error('[Storage] Error in updateClientPreferences:', error);
      throw error;
    }
  }

  async updateClientTraccarMapping(clientId: string, traccarUserId: string | null): Promise<void> {
    try {
      const db = getDb();
      await db.update(schema.clients)
        .set({
          traccarUserId,
          updatedAt: new Date(),
        })
        .where(eq(schema.clients.id, clientId));
    } catch (error) {
      console.error('[Storage] Error in updateClientTraccarMapping:', error);
      throw error;
    }
  }

  async blockClientTraccar(clientId: string): Promise<void> {
    try {
      const db = getDb();
      await db.update(schema.clients)
        .set({
          isTraccarBlocked: 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.clients.id, clientId));
    } catch (error) {
      console.error('[Storage] Error in blockClientTraccar:', error);
      throw error;
    }
  }

  async unblockClientTraccar(clientId: string): Promise<void> {
    try {
      const db = getDb();
      await db.update(schema.clients)
        .set({
          isTraccarBlocked: 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.clients.id, clientId));
    } catch (error) {
      console.error('[Storage] Error in unblockClientTraccar:', error);
      throw error;
    }
  }

  async getClientLastMessageAtraso(clientId: string): Promise<Date | undefined> {
    try {
      const db = getDb();
      const result = await db.query.clientLastMessageAtraso.findFirst({
        where: eq(schema.clientLastMessageAtraso.clientId, clientId),
        orderBy: (table: any) => [desc(table.lastMessageDate)],
      });
      return result?.lastMessageDate;
    } catch (error) {
      console.error('[Storage] Error in getClientLastMessageAtraso:', error);
      return undefined;
    }
  }

  async updateClientLastMessageAtraso(clientId: string): Promise<void> {
    try {
      const db = getDb();
      await db.insert(schema.clientLastMessageAtraso).values({
        clientId,
        lastMessageDate: new Date(),
      });
    } catch (error) {
      console.error('[Storage] Error in updateClientLastMessageAtraso:', error);
      throw error;
    }
  }

  async getFinancialSummary(startDate?: string, endDate?: string): Promise<import('@shared/schema').FinancialSummary> {
    try {
      const db = getDb();
      const allCobrancas = await db.query.cobrancas.findMany();

      const result: import('@shared/schema').FinancialSummary = {
        received: { total: 0, netValue: 0, customers: 0, invoices: 0 },
        confirmed: { total: 0, netValue: 0, customers: 0, invoices: 0 },
        pending: { total: 0, netValue: 0, customers: 0, invoices: 0 },
        overdue: { total: 0, netValue: 0, customers: 0, invoices: 0 },
      };

      const customerSets = {
        RECEIVED: new Set<string>(),
        CONFIRMED: new Set<string>(),
        PENDING: new Set<string>(),
        OVERDUE: new Set<string>(),
      };

      let filtered = allCobrancas;
      if (startDate || endDate) {
        filtered = allCobrancas.filter(c => {
          const dueStr = typeof c.dueDate === 'string' ? c.dueDate.split('T')[0] : c.dueDate;
          if (startDate && dueStr < startDate) return false;
          if (endDate && dueStr > endDate) return false;
          return true;
        });
      }

      filtered.forEach(c => {
        const key = (c.status.toUpperCase() as keyof typeof customerSets);
        const resultKey = c.status.toLowerCase() as keyof typeof result;
        
        if (result[resultKey]) {
          const value = typeof c.value === 'string' ? parseFloat(c.value) : c.value;
          result[resultKey].total += value;
          result[resultKey].netValue += value * 0.99;
          result[resultKey].invoices += 1;
          customerSets[key].add(c.customer);
        }
      });

      Object.entries(customerSets).forEach(([status, customers]) => {
        const key = status.toLowerCase() as keyof typeof result;
        if (result[key]) result[key].customers = customers.size;
      });

      return result;
    } catch (error) {
      console.error('[Storage] Error in getFinancialSummary:', error);
      throw error;
    }
  }
}
