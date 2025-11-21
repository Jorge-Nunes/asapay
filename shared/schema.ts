import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  phone: true,
  address: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const configurations = pgTable("configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  asaasToken: text("asaas_token").notNull(),
  asaasUrl: text("asaas_url").notNull(),
  evolutionUrl: text("evolution_url").notNull(),
  evolutionInstance: text("evolution_instance").notNull(),
  evolutionApiKey: text("evolution_api_key").notNull(),
  traccarUrl: text("traccar_url"),
  traccarApiKey: text("traccar_api_key"),
  traccarLimiteCobrancasVencidas: integer("traccar_limite_cobrancas_vencidas").default(3),
  diasAviso: integer("dias_aviso").notNull().default(10),
  messageTemplates: json("message_templates").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cobrancas = pgTable("cobrancas", {
  id: varchar("id").primaryKey(),
  customer: text("customer").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull(), // PENDING, RECEIVED, CONFIRMED, OVERDUE
  invoiceUrl: text("invoice_url").notNull(),
  description: text("description").notNull(),
  tipo: text("tipo"), // vence_hoje, aviso, processada
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const executions = pgTable("executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull(), // running, completed, failed
  cobrancasProcessadas: integer("cobrancas_processadas").notNull().default(0),
  mensagensEnviadas: integer("mensagens_enviadas").notNull().default(0),
  usuariosBloqueados: integer("usuarios_bloqueados").notNull().default(0),
  erros: integer("erros").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const executionLogs = pgTable("execution_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: varchar("execution_id").notNull(),
  cobrancaId: text("cobranca_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  tipo: text("tipo").notNull(), // vence_hoje, aviso, atraso
  status: text("status").notNull(), // success, error
  mensagem: text("mensagem"),
  erro: text("erro"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Config = {
  asaasToken: string;
  asaasUrl: string;
  evolutionUrl: string;
  evolutionInstance: string;
  evolutionApiKey: string;
  traccarUrl?: string;
  traccarApiKey?: string;
  traccarLimiteCobrancasVencidas?: number;
  diasAviso: number;
  messageTemplates: {
    venceHoje: string;
    aviso: string;
    atraso: string;
    bloqueio?: string;
    desbloqueio?: string;
  };
};

export type Cliente = {
  id: string;
  name: string;
  email: string;
  phone: string;
  mobilePhone: string;
};

export type Cobranca = {
  id: string;
  customer: string;
  customerName: string;
  customerPhone: string;
  value: number;
  dueDate: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE';
  invoiceUrl: string;
  description: string;
  tipo?: 'vence_hoje' | 'aviso' | 'processada';
};

export type Execution = {
  id: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed';
  cobrancasProcessadas: number;
  mensagensEnviadas: number;
  usuariosBloqueados: number;
  erros: number;
  detalhes: ExecutionLog[];
};

export type ExecutionLog = {
  id: string;
  cobrancaId: string;
  customerName: string;
  customerPhone: string;
  tipo: 'vence_hoje' | 'aviso' | 'atraso';
  status: 'success' | 'error';
  mensagem?: string;
  erro?: string;
  timestamp: string;
};

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  asaasCustomerId: text("asaas_customer_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobilePhone: text("mobile_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  cpfCnpj: text("cpf_cnpj"),
  blockDailyMessages: integer("block_daily_messages").notNull().default(0),
  diasAtrasoNotificacao: integer("dias_atraso_notificacao").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientLastMessageAtraso = pgTable("client_last_message_atraso", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  lastMessageDate: timestamp("last_message_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DashboardMetrics = {
  totalPendente: number;
  venceHoje: number;
  mensagensEnviadas: number;
  taxaConversao: number;
};

export type ClientData = typeof clients.$inferSelect;
export type InsertClient = Omit<typeof clients.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

export type FinancialSummary = {
  received: { total: number; netValue: number; customers: number; invoices: number };
  confirmed: { total: number; netValue: number; customers: number; invoices: number };
  pending: { total: number; netValue: number; customers: number; invoices: number };
  overdue: { total: number; netValue: number; customers: number; invoices: number };
};
