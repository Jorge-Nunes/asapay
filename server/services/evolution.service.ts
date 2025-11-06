import axios, { type AxiosInstance } from 'axios';

export class EvolutionService {
  private client: AxiosInstance;
  private instance: string;

  constructor(apiUrl: string, apiKey: string, instance: string) {
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'apikey': apiKey,
      },
    });
    this.instance = instance;
  }

  async sendTextMessage(phone: string, message: string): Promise<boolean> {
    try {
      // Ensure phone starts with country code
      const formattedPhone = phone.startsWith('+') ? phone : `+55${phone}`;

      const response = await this.client.post(`/message/sendText/${this.instance}`, {
        number: formattedPhone,
        textMessage: {
          text: message,
        },
      });

      return response.status === 200 || response.status === 201;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async sendBulkMessages(
    messages: Array<{ phone: string; message: string }>
  ): Promise<Array<{ phone: string; success: boolean; error?: string }>> {
    const results = [];

    for (const { phone, message } of messages) {
      try {
        const success = await this.sendTextMessage(phone, message);
        results.push({ phone, success });
        
        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({ 
          phone, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }
}
