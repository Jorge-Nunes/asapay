import axios, { type AxiosInstance } from 'axios';

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
      console.log(`[Evolution] Fetching instance status for: ${this.instance}`);
      // Try new Evolution 1.8.6 endpoint first
      let response;
      try {
        response = await this.client.get(`/instances/${this.instance}`);
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Fall back to old endpoint
          console.log('[Evolution] Trying fallback endpoint /instance/connect');
          response = await this.client.get(`/instance/connect/${this.instance}`);
        } else {
          throw error;
        }
      }
      
      const data = response.data;
      console.log(`[Evolution] Full response structure:`, {
        status: response.status,
        dataType: typeof data,
        dataKeys: Object.keys(data || {}),
        dataString: JSON.stringify(data).substring(0, 500),
      });
      
      // Evolution 1.8.6 returns QR in base64 field when waiting for pairing
      // Structure: { pairingCode, code, base64, count }
      let qrCode: string | undefined = undefined;
      let status: 'open' | 'closed' | 'connecting' | 'qr' | 'unknown' = 'unknown';
      
      if (data.base64) {
        // Has QR code, waiting for connection
        qrCode = data.base64;
        status = 'qr';
      } else if (data.instance?.state === 'open') {
        // Instance is connected
        status = 'open';
      } else if (data.instance?.state) {
        // Instance has a state
        status = data.instance.state;
      } else if (data.code && !data.base64) {
        // Has code but no base64 = might be connected
        status = 'open';
      }
      
      console.log(`[Evolution] Parsed instance status:`, {
        hasBase64QR: !!data.base64,
        hasCode: !!data.code,
        status: status,
        qrCodeLength: qrCode?.length || 0,
      });
      
      return {
        instanceName: data.instanceName || this.instance,
        status: status,
        qrCode: qrCode,
        connected: status === 'open',
        phone: data.wid,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      // Log the actual error
      console.error(`[Evolution] Error fetching status for '${this.instance}':`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        endpoint: error.config?.url,
      });
      
      // Return unknown status instead of throwing
      return {
        instanceName: this.instance,
        status: 'unknown',
        connected: false,
        timestamp: Date.now(),
      };
    }
  }

  async getQrCode(): Promise<string | null> {
    try {
      // Try new Evolution 1.8.6 endpoint first
      let response;
      try {
        response = await this.client.get(`/instances/${this.instance}`);
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Fall back to old endpoint
          response = await this.client.get(`/instance/connect/${this.instance}`);
        } else {
          throw error;
        }
      }
      
      // Evolution 1.8.6 returns base64 encoded QR code
      const qr = response.data?.base64 || response.data?.qrcode?.qr;
      console.log(`[Evolution] QR code for ${this.instance}:`, qr ? 'found' : 'not found');
      return qr || null;
    } catch (error: any) {
      console.error('[Evolution] Error fetching QR code:', {
        message: error.message,
        endpoint: error.config?.url,
      });
      return null;
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
      console.log('[Evolution] Creating instance with POST /instance/create:', instanceName);
      const response = await this.client.post(`/instance/create`, {
        instanceName,
      });
      
      console.log('[Evolution] Create response:', {
        status: response.status,
        hasQR: !!response.data?.qrcode?.qr,
        instanceName: response.data?.instance?.instanceName,
      });
      
      return {
        instanceName,
        status: response.data?.instance?.state || 'qr',
        qrCode: response.data?.qrcode?.qr,
        connected: false,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error('[Evolution] Error creating instance:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
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
