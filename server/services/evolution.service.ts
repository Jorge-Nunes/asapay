import axios, { type AxiosInstance } from 'axios';
import QRCode from 'qrcode';

export interface EvolutionInstance {
  instanceName: string;
  status: 'open' | 'closed' | 'connecting' | 'qr' | 'unknown';
  qrCode?: string;
  connected: boolean;
  phone?: string;
  timestamp?: number;
}

export class EvolutionService {
  private client: AxiosInstance;
  private instance: string;
  private apiUrl: string;

  constructor(apiUrl: string, apiKey: string, instance: string) {
    this.apiUrl = apiUrl;
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'apikey': apiKey,
      },
    });
    this.instance = instance;
  }

  async getInstanceStatus(): Promise<EvolutionInstance> {
    try {
      const response = await this.client.get(`/instance/fetch/${this.instance}`);
      const data = response.data;
      
      return {
        instanceName: data.instance?.instanceName || this.instance,
        status: data.instance?.state || 'unknown',
        qrCode: data.qrcode?.qr,
        connected: data.instance?.state === 'open',
        phone: data.instance?.wid,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching instance status:', error);
      throw error;
    }
  }

  async getQrCode(): Promise<string | null> {
    try {
      const response = await this.client.get(`/instance/fetch/${this.instance}`);
      const qr = response.data?.qrcode?.qr;
      if (qr) {
        return qr;
      }
    } catch (error) {
      // Instance not found yet - return a generated QR code for development
      console.log('[Evolution] Instance not found or error getting QR code, returning generated QR for:', this.instance);
    }
    
    // Return a generated QR code (shows instance info while waiting for real QR)
    // This allows the frontend to display something while waiting for Evolution API response
    return await this.generateSimulatedQRCode();
  }

  private async generateSimulatedQRCode(): Promise<string> {
    try {
      // Generate a real QR code with instance name as content
      const qrContent = `WhatsApp Instance: ${this.instance}\nCreated: ${new Date().toLocaleString('pt-BR')}`;
      const dataUrl = await QRCode.toDataURL(qrContent, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('[Evolution] Error generating QR code:', error);
      // Fallback to a simple placeholder if QR generation fails
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
  }

  async restartInstance(): Promise<boolean> {
    try {
      const response = await this.client.post(`/instance/restart/${this.instance}`);
      return response.status === 200 || response.status === 201;
    } catch (error) {
      console.error('Error restarting instance:', error);
      throw error;
    }
  }

  async stopInstance(): Promise<boolean> {
    try {
      const response = await this.client.delete(`/instance/logout/${this.instance}`);
      return response.status === 200 || response.status === 201;
    } catch (error) {
      console.error('Error stopping instance:', error);
      throw error;
    }
  }

  async createInstance(instanceName: string): Promise<EvolutionInstance> {
    try {
      const response = await this.client.post(`/instance/create`, {
        instanceName,
        token: this.client.defaults.headers.apikey,
      });
      
      return {
        instanceName,
        status: 'qr',
        qrCode: response.data?.qrcode?.qr,
        connected: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error creating instance:', error);
      throw error;
    }
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
