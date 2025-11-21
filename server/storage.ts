import { randomUUID } from "crypto";
import type { Config, Cobranca, Execution, ExecutionLog, DashboardMetrics, ClientData, InsertClient } from "@shared/schema";

import type { FinancialSummary } from "@shared/schema";

export interface IStorage {
  // Config
  getConfig(): Promise<Config>;
  updateConfig(config: Partial<Config>): Promise<Config>;

  // Cobranças
  getCobrancas(): Promise<Cobranca[]>;
  getCobrancaById(id: string): Promise<Cobranca | undefined>;
  saveCobrancas(cobrancas: Cobranca[]): Promise<void>;
  updateCobranca(id: string, data: Partial<Cobranca>): Promise<Cobranca | undefined>;

  // Executions
  getExecutions(): Promise<Execution[]>;
  getExecutionById(id: string): Promise<Execution | undefined>;
  createExecution(execution: Omit<Execution, 'id'>): Promise<Execution>;
  updateExecution(id: string, data: Partial<Execution>): Promise<Execution | undefined>;

  // Execution Logs
  getExecutionLogs(executionId?: string): Promise<ExecutionLog[]>;
  addExecutionLog(log: Omit<ExecutionLog, 'id'>): Promise<ExecutionLog>;

  // Dashboard
  getDashboardMetrics(): Promise<DashboardMetrics>;
  getFinancialSummary(startDate?: string, endDate?: string): Promise<FinancialSummary>;

  // Users
  getUsers(): Promise<any[]>;
  getUserById(id: string): Promise<any | undefined>;
  getUserByUsername(username: string): Promise<any | undefined>;
  createUser(user: { username: string; password: string }): Promise<any>;
  updateUser(id: string, data: { username?: string; password?: string }): Promise<any | undefined>;
  deleteUser(id: string): Promise<void>;

  // Clients
  getClients(): Promise<ClientData[]>;
  getClientByAsaasId(asaasCustomerId: string): Promise<ClientData | undefined>;
  syncClients(clients: InsertClient[]): Promise<void>;
  updateClientPreferences(clientId: string, blockDailyMessages: boolean, diasAtrasoNotificacao: number): Promise<void>;
  getClientLastMessageAtraso(clientId: string): Promise<Date | undefined>;
  updateClientLastMessageAtraso(clientId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private config: Config;
  private cobrancas: Map<string, Cobranca>;
  private executions: Map<string, Execution>;
  private executionLogs: ExecutionLog[];
  private clients: Map<string, ClientData>;
  private clientLastMessageAtraso: Map<string, Date>;

  constructor() {
    this.config = {
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
    this.cobrancas = new Map();
    this.executions = new Map();
    this.executionLogs = [];
    this.clients = new Map();
    this.clientLastMessageAtraso = new Map();
  }

  async getConfig(): Promise<Config> {
    return this.config;
  }

  async updateConfig(config: Partial<Config>): Promise<Config> {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  async getCobrancas(): Promise<Cobranca[]> {
    return Array.from(this.cobrancas.values());
  }

  async getCobrancaById(id: string): Promise<Cobranca | undefined> {
    return this.cobrancas.get(id);
  }

  async saveCobrancas(cobrancas: Cobranca[]): Promise<void> {
    for (const cobranca of cobrancas) {
      this.cobrancas.set(cobranca.id, cobranca);
    }
  }

  async updateCobranca(id: string, data: Partial<Cobranca>): Promise<Cobranca | undefined> {
    const cobranca = this.cobrancas.get(id);
    if (!cobranca) return undefined;
    
    const updated = { ...cobranca, ...data };
    this.cobrancas.set(id, updated);
    return updated;
  }

  async getExecutions(): Promise<Execution[]> {
    return Array.from(this.executions.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getExecutionById(id: string): Promise<Execution | undefined> {
    return this.executions.get(id);
  }

  async createExecution(execution: Omit<Execution, 'id'>): Promise<Execution> {
    const id = randomUUID();
    const newExecution: Execution = { ...execution, id };
    this.executions.set(id, newExecution);
    return newExecution;
  }

  async updateExecution(id: string, data: Partial<Execution>): Promise<Execution | undefined> {
    const execution = this.executions.get(id);
    if (!execution) return undefined;
    
    const updated = { ...execution, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async getExecutionLogs(executionId?: string): Promise<ExecutionLog[]> {
    if (executionId) {
      const execution = this.executions.get(executionId);
      return execution?.detalhes || [];
    }
    return this.executionLogs;
  }

  async addExecutionLog(log: Omit<ExecutionLog, 'id'>): Promise<ExecutionLog> {
    const id = randomUUID();
    const newLog: ExecutionLog = { ...log, id };
    this.executionLogs.push(newLog);
    return newLog;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cobrancas = Array.from(this.cobrancas.values());
    const pendentes = cobrancas.filter(c => c.status === 'PENDING');
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const venceHoje = pendentes.filter(c => {
      const dueDate = new Date(c.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === hoje.getTime();
    }).length;

    const totalPendente = pendentes.reduce((sum, c) => sum + c.value, 0);

    // Count messages sent in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const mensagensEnviadas = this.executionLogs.filter(log => 
      new Date(log.timestamp) > thirtyDaysAgo && log.status === 'success'
    ).length;

    // Calculate conversion rate (paid vs total in last 30 days)
    const recebidas = cobrancas.filter(c => 
      c.status === 'RECEIVED' || c.status === 'CONFIRMED'
    ).length;
    const total = cobrancas.length || 1;
    const taxaConversao = (recebidas / total) * 100;

    return {
      totalPendente,
      venceHoje,
      mensagensEnviadas,
      taxaConversao,
    };
  }

  async getClients(): Promise<ClientData[]> {
    return Array.from(this.clients.values());
  }

  async getClientByAsaasId(asaasCustomerId: string): Promise<ClientData | undefined> {
    for (const client of this.clients.values()) {
      if (client.asaasCustomerId === asaasCustomerId) {
        return client;
      }
    }
    return undefined;
  }

  async syncClients(clients: InsertClient[]): Promise<void> {
    for (const client of clients) {
      const existing = await this.getClientByAsaasId(client.asaasCustomerId);
      
      if (existing) {
        const updated: ClientData = {
          ...existing,
          ...client,
        };
        this.clients.set(existing.id, updated);
      } else {
        const newClient: ClientData = {
          id: randomUUID(),
          ...client,
          blockDailyMessages: 0,
          diasAtrasoNotificacao: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.clients.set(newClient.id, newClient);
      }
    }
  }

  async updateClientPreferences(clientId: string, blockDailyMessages: boolean, diasAtrasoNotificacao: number): Promise<void> {
    const client = this.clients.get(clientId);
    if (client) {
      const updated: ClientData = {
        ...client,
        blockDailyMessages: blockDailyMessages ? 1 : 0,
        diasAtrasoNotificacao,
        updatedAt: new Date(),
      };
      this.clients.set(clientId, updated);
    }
  }

  async getClientLastMessageAtraso(clientId: string): Promise<Date | undefined> {
    return this.clientLastMessageAtraso.get(clientId);
  }

  async updateClientLastMessageAtraso(clientId: string): Promise<void> {
    this.clientLastMessageAtraso.set(clientId, new Date());
  }

  async getFinancialSummary(startDate?: string, endDate?: string): Promise<import('@shared/schema').FinancialSummary> {
    const cobrancas = Array.from(this.cobrancas.values());
    const result: import('@shared/schema').FinancialSummary = {
      received: { total: 0, netValue: 0, customers: new Set<string>().size, invoices: 0 },
      confirmed: { total: 0, netValue: 0, customers: new Set<string>().size, invoices: 0 },
      pending: { total: 0, netValue: 0, customers: new Set<string>().size, invoices: 0 },
      overdue: { total: 0, netValue: 0, customers: new Set<string>().size, invoices: 0 },
    };

    const customerSets = {
      RECEIVED: new Set<string>(),
      CONFIRMED: new Set<string>(),
      PENDING: new Set<string>(),
      OVERDUE: new Set<string>(),
    };

    let filtered = cobrancas;
    if (startDate || endDate) {
      filtered = cobrancas.filter(c => {
        const dueDate = new Date(c.dueDate);
        if (startDate) {
          const start = new Date(startDate);
          if (dueDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (dueDate > end) return false;
        }
        return true;
      });
    }

    filtered.forEach(c => {
      const key = (c.status as keyof typeof result).toLowerCase() as keyof typeof result;
      if (result[key]) {
        result[key].total += parseFloat(c.value.toString());
        result[key].netValue += parseFloat(c.value.toString()) * 0.99;
        result[key].invoices += 1;
        customerSets[c.status as keyof typeof customerSets].add(c.customer);
      }
    });

    Object.entries(customerSets).forEach(([status, customers]) => {
      const key = status.toLowerCase() as keyof typeof result;
      if (result[key]) result[key].customers = customers.size;
    });

    return result;
  }
}

export const storage = new MemStorage();
