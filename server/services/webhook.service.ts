import { storage } from "../index";
import { EvolutionService } from "./evolution.service";
import { TraccarService } from "./traccar.service";

export interface AsaasWebhookPayload {
  id?: string;
  event: string;
  dateCreated?: string;
  data?: {
    id: string;
    customer?: string;
    payment?: {
      id: string;
      status: string;
      value: number;
      dueDate: string;
      confirmedDate?: string;
    };
    [key: string]: any;
  };
  payment?: {
    id: string;
    customer: string;
    value: number;
    dueDate: string;
    status: string;
    description: string;
    billingType: string;
    invoiceUrl: string;
    customerName?: string;
    phone?: string;
    mobilePhone?: string;
    email?: string;
    [key: string]: any;
  };
}

export class WebhookService {
  async processAsaasWebhook(payload: AsaasWebhookPayload): Promise<void> {
    console.log(`[Webhook] Processando evento: ${payload.event}`);

    try {
      switch (payload.event) {
        case "PAYMENT_CREATED":
          await this.handlePaymentCreated(payload);
          break;
        case "PAYMENT_RECEIVED":
        case "PAYMENT_CONFIRMED":
          await this.handlePaymentConfirmed(payload);
          break;
        case "PAYMENT_OVERDUE":
          await this.handlePaymentOverdue(payload);
          break;
        case "PAYMENT_DELETED":
          await this.handlePaymentDeleted(payload);
          break;
        default:
          console.log(`[Webhook] Evento não tratado: ${payload.event}`);
      }
    } catch (error) {
      console.error(`[Webhook] Erro ao processar evento ${payload.event}:`, error);
      throw error;
    }
  }

  private async handlePaymentCreated(payload: AsaasWebhookPayload): Promise<void> {
    try {
      // Get payment data - can be in payload.payment or payload.data.payment
      const paymentData = payload.payment || payload.data?.payment;
      
      if (!paymentData) {
        console.log(`[Webhook] Payload inválido para PAYMENT_CREATED - sem payment`);
        return;
      }

      const paymentId = paymentData.id;
      const customerId = paymentData.customer;

      if (!paymentId || !customerId) {
        console.log(`[Webhook] Payload inválido para PAYMENT_CREATED - sem ID ou customer`);
        return;
      }

      console.log(`[Webhook] Nova cobrança criada: ${paymentId} (cliente: ${customerId})`);

      // Check if cobrança already exists
      const allCobrancas = await storage.getCobrancas();
      const existingCobranca = allCobrancas.find(c => c.id === paymentId);

      if (!existingCobranca) {
        // Try to fetch full payment details from Asaas
        const config = await storage.getConfig();
        if (!config.asaasToken || !config.asaasUrl) {
          console.log(`[Webhook] Asaas não configurado para sincronizar cobrança ${paymentId}`);
          return;
        }

        try {
          const response = await fetch(`${config.asaasUrl}/payments/${paymentId}`, {
            headers: { 'access_token': config.asaasToken }
          });

          if (response.ok) {
            const fullPaymentData = await response.json();
            
            // Create new cobrança
            const newCobranca = {
              id: fullPaymentData.id,
              customer: fullPaymentData.customer,
              customerName: fullPaymentData.customerName || 'Desconhecido',
              customerPhone: fullPaymentData.phone || fullPaymentData.mobilePhone || '',
              value: fullPaymentData.value || 0,
              dueDate: fullPaymentData.dueDate || new Date().toISOString().split('T')[0],
              status: 'PENDING' as const,
              invoiceUrl: fullPaymentData.invoiceUrl || '',
              description: fullPaymentData.description || '',
              tipo: 'importada' as const
            };

            await storage.createCobranca(newCobranca);
            console.log(`[Webhook] Cobrança ${paymentId} sincronizada com sucesso`);

            // Also check if customer exists and create if needed
            const allClients = await storage.getClients();
            const clientExists = allClients.find(c => c.asaasId === customerId);
            
            if (!clientExists && fullPaymentData.customerName) {
              const newClient = {
                name: fullPaymentData.customerName,
                asaasId: customerId,
                phone: fullPaymentData.phone || '',
                mobilePhone: fullPaymentData.mobilePhone || fullPaymentData.phone || '',
                email: fullPaymentData.email || '',
                traccarUserId: '',
                isTraccarBlocked: false,
                lastMessageAtraso: null,
              };
              await storage.createClient(newClient);
              console.log(`[Webhook] Cliente ${customerId} sincronizado com sucesso`);
            }
          } else {
            console.log(`[Webhook] Erro ao buscar detalhes da cobrança ${paymentId} no Asaas (status: ${response.status})`);
          }
        } catch (error) {
          console.error(`[Webhook] Erro ao sincronizar cobrança do Asaas:`, error);
        }
      } else {
        console.log(`[Webhook] Cobrança ${paymentId} já existe`);
      }
    } catch (error) {
      console.error(`[Webhook] Erro em handlePaymentCreated:`, error);
      throw error;
    }
  }

  private async handlePaymentConfirmed(payload: AsaasWebhookPayload): Promise<void> {
    try {
      // Get payment data - can be in payload.payment or payload.data.payment
      const paymentData = payload.payment || payload.data?.payment;
      
      if (!paymentData) {
        console.log(`[Webhook] Payload inválido para PAYMENT_CONFIRMED - sem payment`);
        return;
      }

      const paymentId = paymentData.id;
      
      if (!paymentId) {
        console.log(`[Webhook] Payload inválido para PAYMENT_CONFIRMED - sem ID`);
        return;
      }

      console.log(`[Webhook] Pagamento recebido/confirmado: ${paymentId}`);

      // Update cobrança status to RECEIVED
      const allCobrancas = await storage.getCobrancas();
      const cobranca = allCobrancas.find(c => c.id === paymentId);

      if (cobranca) {
        await storage.updateCobranca(cobranca.id, {
          status: "RECEIVED",
          tipo: "processada",
        });

        console.log(`[Webhook] Cobrança ${cobranca.id} atualizada para RECEIVED`);

        // Check if customer should be unblocked in Traccar
        await this.checkAndUnblockTraccar(cobranca.customer);

        // Try to send confirmation message
        try {
          const config = await storage.getConfig();
          if (config.messageTemplates?.pagamentoConfirmado && config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
            const evolutionService = new EvolutionService(
              config.evolutionUrl,
              config.evolutionApiKey,
              config.evolutionInstance
            );

            const phone = cobranca.customerPhone?.replace(/\D/g, "") || "";
            const confirmationMessage = config.messageTemplates.pagamentoConfirmado
              .replace('{{cliente_nome}}', cobranca.customerName)
              .replace('{{valor}}', cobranca.value.toString())
              .replace('{{data}}', new Date().toLocaleDateString('pt-BR'));

            await evolutionService.sendTextMessage(phone, confirmationMessage);
            console.log(`[Webhook] Mensagem de confirmação enviada para ${phone}`);
          }
        } catch (error) {
          console.error(`[Webhook] Erro ao enviar mensagem de confirmação:`, error);
        }
      } else {
        console.log(`[Webhook] Cobrança com ID ${paymentId} não encontrada`);
      }
    } catch (error) {
      console.error(`[Webhook] Erro em handlePaymentConfirmed:`, error);
      throw error;
    }
  }

  private async checkAndUnblockTraccar(customerId: string): Promise<void> {
    try {
      const config = await storage.getConfig();
      if (!config.traccarUrl || !config.traccarApiKey) {
        console.log(`[Webhook] Traccar não configurado`);
        return;
      }

      // Find client by Asaas customer ID
      const allClients = await storage.getClients();
      const client = allClients.find(c => c.asaasId === customerId);

      if (!client || !client.traccarUserId) {
        console.log(`[Webhook] Cliente ou mapeamento Traccar não encontrado`);
        return;
      }

      // Check if customer still has overdue payments exceeding limit
      const allCobrancas = await storage.getCobrancas();
      const customerOverdueCobrancas = allCobrancas.filter(
        c => c.customer === customerId && c.status === 'OVERDUE'
      );

      const limite = config.traccarLimiteCobrancasVencidas || 3;

      if (customerOverdueCobrancas.length < limite && client.isTraccarBlocked) {
        console.log(`[Webhook] Desbloqueando usuário ${client.name} no Traccar (atrasos: ${customerOverdueCobrancas.length}/${limite})`);
        
        const traccarService = new TraccarService(config);
        await traccarService.unblockUser(parseInt(client.traccarUserId));
        await storage.unblockClientTraccar(client.id);

        // Send unblock message
        try {
          if (config.messageTemplates?.desbloqueio && config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
            const evolutionService = new EvolutionService(
              config.evolutionUrl,
              config.evolutionApiKey,
              config.evolutionInstance
            );

            const phone = client.mobilePhone || client.phone || '';
            if (phone) {
              const cleanPhone = phone.replace(/\D/g, '');
              const message = config.messageTemplates.desbloqueio
                .replace('{{nome}}', client.name)
                .replace('{{data}}', new Date().toLocaleDateString('pt-BR'));
              
              await evolutionService.sendTextMessage(cleanPhone, message);
              console.log(`[Webhook] Mensagem de desbloqueio enviada para ${cleanPhone}`);
            }
          }
        } catch (error) {
          console.error(`[Webhook] Erro ao enviar mensagem de desbloqueio:`, error);
        }
      } else {
        console.log(`[Webhook] Cliente não será desbloqueado (atrasos: ${customerOverdueCobrancas.length}/${limite})`);
      }
    } catch (error) {
      console.error(`[Webhook] Erro ao verificar desbloqueio Traccar:`, error);
    }
  }

  private async handlePaymentOverdue(payload: AsaasWebhookPayload): Promise<void> {
    try {
      // Get payment data - can be in payload.payment or payload.data.payment
      const paymentData = payload.payment || payload.data?.payment;
      
      if (!paymentData) {
        console.log(`[Webhook] Payload inválido para PAYMENT_OVERDUE - sem payment`);
        return;
      }

      const paymentId = paymentData.id;
      
      if (!paymentId) {
        console.log(`[Webhook] Payload inválido para PAYMENT_OVERDUE - sem ID`);
        return;
      }

      console.log(`[Webhook] Cobrança vencida: ${paymentId}`);

      const allCobrancas = await storage.getCobrancas();
      const cobranca = allCobrancas.find(c => c.id === paymentId);

      if (cobranca) {
        await storage.updateCobranca(cobranca.id, {
          status: "OVERDUE",
        });

        console.log(`[Webhook] Cobrança ${cobranca.id} atualizada para OVERDUE`);
      } else {
        console.log(`[Webhook] Cobrança com ID ${paymentId} não encontrada`);
      }
    } catch (error) {
      console.error(`[Webhook] Erro em handlePaymentOverdue:`, error);
      throw error;
    }
  }

  private async handlePaymentDeleted(payload: AsaasWebhookPayload): Promise<void> {
    try {
      // Get payment data - can be in payload.payment or payload.data.payment
      const paymentData = payload.payment || payload.data?.payment;
      
      if (!paymentData) {
        console.log(`[Webhook] Payload inválido para PAYMENT_DELETED - sem payment`);
        return;
      }

      const paymentId = paymentData.id;
      
      if (!paymentId) {
        console.log(`[Webhook] Payload inválido para PAYMENT_DELETED - sem ID`);
        return;
      }

      console.log(`[Webhook] Cobrança deletada: ${paymentId}`);

      const allCobrancas = await storage.getCobrancas();
      const cobranca = allCobrancas.find(c => c.id === paymentId);

      if (cobranca) {
        await storage.updateCobranca(cobranca.id, {
          status: "DELETED",
        });

        console.log(`[Webhook] Cobrança ${cobranca.id} atualizada para DELETED`);
      } else {
        console.log(`[Webhook] Cobrança com ID ${paymentId} não encontrada`);
      }
    } catch (error) {
      console.error(`[Webhook] Erro em handlePaymentDeleted:`, error);
      throw error;
    }
  }
}
