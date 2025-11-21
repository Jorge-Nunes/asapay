import { storage } from "../index";
import { EvolutionService } from "./evolution.service";

export interface AsaasWebhookPayload {
  event: string;
  data: {
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
}

export class WebhookService {
  async processAsaasWebhook(payload: AsaasWebhookPayload): Promise<void> {
    console.log(`[Webhook] Processando evento: ${payload.event}`);

    try {
      switch (payload.event) {
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

  private async handlePaymentConfirmed(payload: AsaasWebhookPayload): Promise<void> {
    const paymentId = payload.data.id;
    console.log(`[Webhook] Pagamento recebido/confirmado: ${paymentId}`);

    // Update cobrança status to RECEIVED
    const allCobrancas = await storage.getCobrancas();
    const cobranca = allCobrancas.find(c => c.id === paymentId || c.id === payload.data.payment?.id);

    if (cobranca) {
      await storage.updateCobranca(cobranca.id, {
        status: "RECEIVED",
        tipo: "processada",
      });

      console.log(`[Webhook] Cobrança ${cobranca.id} atualizada para RECEIVED`);

      // Try to send confirmation message
      try {
        const config = await storage.getConfig();
        if (config.evolutionUrl && config.evolutionApiKey && config.evolutionInstance) {
          const evolutionService = new EvolutionService(
            config.evolutionUrl,
            config.evolutionApiKey,
            config.evolutionInstance
          );

          const phone = cobranca.customerPhone?.replace(/\D/g, "") || "";
          const confirmationMessage = `✅ *Pagamento Recebido!*\nOlá ${cobranca.customerName}, recebemos seu pagamento de R$ ${cobranca.value}.\n\nObrigado! 🙏`;

          await evolutionService.sendTextMessage(phone, confirmationMessage);
          console.log(`[Webhook] Mensagem de confirmação enviada para ${phone}`);
        }
      } catch (error) {
        console.error(`[Webhook] Erro ao enviar mensagem de confirmação:`, error);
      }
    }
  }

  private async handlePaymentOverdue(payload: AsaasWebhookPayload): Promise<void> {
    const paymentId = payload.data.id;
    console.log(`[Webhook] Cobrança vencida: ${paymentId}`);

    const allCobrancas = await storage.getCobrancas();
    const cobranca = allCobrancas.find(c => c.id === paymentId || c.id === payload.data.payment?.id);

    if (cobranca) {
      await storage.updateCobranca(cobranca.id, {
        status: "OVERDUE",
      });

      console.log(`[Webhook] Cobrança ${cobranca.id} atualizada para OVERDUE`);
    }
  }

  private async handlePaymentDeleted(payload: AsaasWebhookPayload): Promise<void> {
    const paymentId = payload.data.id;
    console.log(`[Webhook] Cobrança deletada: ${paymentId}`);

    const allCobrancas = await storage.getCobrancas();
    const cobranca = allCobrancas.find(c => c.id === paymentId || c.id === payload.data.payment?.id);

    if (cobranca) {
      await storage.updateCobranca(cobranca.id, {
        status: "DELETED",
      });

      console.log(`[Webhook] Cobrança ${cobranca.id} atualizada para DELETED`);
    }
  }
}
