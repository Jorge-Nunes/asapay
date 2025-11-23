import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, bigint, json, index } from "drizzle-orm/pg-core";
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
  traccarUsername: text("traccar_username").default("admin"), // Username for Traccar (especially for v4.15)
  traccarPassword: text("traccar_password"), // Password for Traccar (especially for v4.15)
  traccarVersion: text("traccar_version").default("latest"), // latest (newer versions) or 4.15
  traccarLimiteCobrancasVencidas: integer("traccar_limite_cobrancas_vencidas").default(3),
  diasAviso: integer("dias_aviso").notNull().default(10),
  messageTemplates: json("message_templates").notNull(),
  webhookUrl: text("webhook_url"),
  lastClientSyncTime: bigint("last_client_sync_time", { mode: 'number' }).default(0),
  lastCobrancasSyncTime: bigint("last_cobrancas_sync_time", { mode: 'number' }).default(0),
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
}, (table) => ({
  customerIdx: index("idx_cobrancas_customer").on(table.customer),
  statusIdx: index("idx_cobrancas_status").on(table.status),
  dueDateIdx: index("idx_cobrancas_due_date").on(table.dueDate),
}));

export const executions = pgTable("executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull(), // running, completed, failed
  cobrancasProcessadas: integer("cobrancas_processadas").notNull().default(0),
  mensagensEnviadas: integer("mensagens_enviadas").notNull().default(0),
  usuariosBloqueados: integer("usuarios_bloqueados").notNull().default(0),
  erros: integer("erros").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  timestampIdx: index("idx_executions_timestamp").on(table.timestamp),
  statusIdx: index("idx_executions_status").on(table.status),
}));

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
}, (table) => ({
  executionIdIdx: index("idx_execution_logs_execution_id").on(table.executionId),
  cobrancaIdIdx: index("idx_execution_logs_cobranca_id").on(table.cobrancaId),
  statusIdx: index("idx_execution_logs_status").on(table.status),
}));

export type EvolutionInstanceData = {
  name: string;
  status: 'open' | 'closed' | 'connecting' | 'qr' | 'unknown';
  connected: boolean;
  phone?: string;
  createdAt: number;
  lastStatusUpdate?: number;
};

export type Config = {
  asaasToken: string;
  asaasUrl: string;
  evolutionUrl: string;
  evolutionInstance: string;
  evolutionApiKey: string;
  evolutionInstances?: EvolutionInstanceData[];
  activeEvolutionInstance?: string;
  traccarUrl?: string;
  traccarApiKey?: string;
  traccarUsername?: string; // Username for Traccar (especially for v4.15)
  traccarPassword?: string; // Password for Traccar (especially for v4.15)
  traccarVersion?: string; // latest or 4.15
  traccarLimiteCobrancasVencidas?: number;
  webhookUrl?: string;
  diasAviso: number;
  messageTemplates: {
    venceHoje: string;
    aviso: string;
    atraso: string;
    bloqueio?: string;
    desbloqueio?: string;
    pagamentoConfirmado?: string;
  };
  lastClientSyncTime?: number;
  lastCobrancasSyncTime?: number;
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
  traccarUserId: text("traccar_user_id"),
  traccarMappingMethod: text("traccar_mapping_method"), // email, phone, or null if unmapped
  isTraccarBlocked: integer("is_traccar_blocked").notNull().default(0),
  blockDailyMessages: integer("block_daily_messages").notNull().default(0),
  diasAtrasoNotificacao: integer("dias_atraso_notificacao").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  asaasCustomerIdIdx: index("idx_clients_asaas_customer_id").on(table.asaasCustomerId),
  traccarUserIdIdx: index("idx_clients_traccar_user_id").on(table.traccarUserId),
  emailIdx: index("idx_clients_email").on(table.email),
  mobilePhoneIdx: index("idx_clients_mobile_phone").on(table.mobilePhone),
}));

export const clientLastMessageAtraso = pgTable("client_last_message_atraso", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  lastMessageDate: timestamp("last_message_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  clientIdIdx: index("idx_client_last_message_client_id").on(table.clientId),
}));

export const cobrancaMessagesSent = pgTable("cobranca_messages_sent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cobrancaId: varchar("cobranca_id").notNull(),
  sentDate: timestamp("sent_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  cobrancaIdIdx: index("idx_cobranca_messages_sent_cobranca_id").on(table.cobrancaId),
  sentDateIdx: index("idx_cobranca_messages_sent_sent_date").on(table.sentDate),
}));

export type DashboardMetrics = {
  totalPendente: number;
  venceHoje: number;
  venceHojeValue: number;
  totalRecebido: number;
  taxaConversao: number;
  cobrancasProcessadas: number;
  mensagensEnviadas: number;
  erros: number;
};

export type ClientData = typeof clients.$inferSelect;
export type InsertClient = Omit<typeof clients.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

export type FinancialSummary = {
  received: { total: number; netValue: number; customers: number; invoices: number };
  confirmed: { total: number; netValue: number; customers: number; invoices: number };
  pending: { total: number; netValue: number; customers: number; invoices: number };
  overdue: { total: number; netValue: number; customers: number; invoices: number };
};
