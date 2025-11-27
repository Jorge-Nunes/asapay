import type { Config } from "@shared/schema";

export class TraccarService {
  private baseUrl: string;
  private apiKey: string;
  private username: string;
  private password: string;
  private version: string;
  private authMethod: string;
  private sessionCookie: string | null = null;

  constructor(config: Config) {
    this.baseUrl = config.traccarUrl || '';
    this.apiKey = config.traccarApiKey || '';
    this.username = config.traccarUsername || 'admin'; // Default Traccar user
    this.password = config.traccarPassword || this.apiKey; // Use password if provided, otherwise API key
    this.version = config.traccarVersion || 'latest';
    this.authMethod = config.traccarAuthMethod || 'session'; // 'session' or 'bearer'
  }

  // Method for latest Traccar versions (uses Bearer token)
  private async getUsersLatest() {
    const response = await fetch(`${this.baseUrl}/api/users`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar usuários Traccar: ${response.statusText}`);
    }

    return response.json();
  }

  // Method for Traccar 4.15 (uses session cookies)
  private async getUsersV415() {
    // Try to get session cookie if not already cached
    if (!this.sessionCookie) {
      await this.authenticateV415();
    }

    const response = await fetch(`${this.baseUrl}/api/users`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.sessionCookie || '',
      },
    });

    if (!response.ok) {
      // If session expired, try to re-authenticate
      if (response.status === 401) {
        this.sessionCookie = null;
        await this.authenticateV415();
        return this.getUsersV415();
      }
      throw new Error(`Erro ao buscar usuários Traccar: ${response.statusText}`);
    }

    return response.json();
  }

  private async authenticateV415() {
    const response = await fetch(`${this.baseUrl}/api/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
    });

    if (!response.ok) {
      throw new Error(`Falha na autenticação Traccar 4.15: ${response.statusText}`);
    }

    // Extract JSESSIONID from Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/JSESSIONID=([^;]+)/);
      if (match) {
        this.sessionCookie = `JSESSIONID=${match[1]}`;
      }
    }
  }

  async getUsers() {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Traccar não configurado');
    }

    try {
      console.log(`[TraccarService] Usando método de autenticação: ${this.authMethod}`);
      if (this.authMethod === 'session') {
        return await this.getUsersV415();
      } else {
        return await this.getUsersLatest();
      }
    } catch (error) {
      console.error(`[TraccarService] Error getting users (method=${this.authMethod}):`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string) {
    const users = await this.getUsers();
    return users.find((u: any) => u.email === email);
  }

  async getUserByPhone(phone: string) {
    const users = await this.getUsers();
    const cleanPhone = phone.replace(/\D/g, '');
    return users.find((u: any) => {
      const userPhone = u.name?.replace(/\D/g, '') || '';
      return userPhone === cleanPhone;
    });
  }

  async getUserById(userId: string | number) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Traccar não configurado');
    }

    const headers = this.authMethod === 'session'
      ? { 'Content-Type': 'application/json', 'Cookie': this.sessionCookie || '' }
      : { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };

    let response = await fetch(`${this.baseUrl}/api/users/${userId}`, { headers });

    if (!response.ok) {
      // For session auth, if we get 401, try to re-authenticate
      if (response.status === 401 && this.authMethod === 'session') {
        this.sessionCookie = null;
        await this.authenticateV415();
        const newHeaders = { 'Content-Type': 'application/json', 'Cookie': this.sessionCookie || '' };
        response = await fetch(`${this.baseUrl}/api/users/${userId}`, { headers: newHeaders });
      }
      
      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        }
        throw new Error(`Erro ao buscar usuário Traccar: ${response.statusText}`);
      }
    }

    return response.json();
  }

  async blockUser(userId: number) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Traccar não configurado');
    }

    // For session auth, ensure we have a valid session
    if (this.authMethod === 'session' && !this.sessionCookie) {
      await this.authenticateV415();
    }

    const authHeaders = this.authMethod === 'session'
      ? { 'Content-Type': 'application/json', 'Cookie': this.sessionCookie || '' }
      : { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };

    // First, get the current user data
    let getResponse = await fetch(`${this.baseUrl}/api/users/${userId}`, { headers: authHeaders });

    // If 401 on session auth, re-authenticate and retry
    if (!getResponse.ok && getResponse.status === 401 && this.authMethod === 'session') {
      this.sessionCookie = null;
      await this.authenticateV415();
      const newHeaders = { 'Content-Type': 'application/json', 'Cookie': this.sessionCookie || '' };
      getResponse = await fetch(`${this.baseUrl}/api/users/${userId}`, { headers: newHeaders });
    }

    if (!getResponse.ok) {
      throw new Error(`Erro ao buscar dados do usuário: ${getResponse.statusText}`);
    }

    const user = await getResponse.json();

    // Update with disabled: true
    const response = await fetch(`${this.baseUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ ...user, disabled: true }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao bloquear usuário: ${response.statusText}`);
    }

    return response.json();
  }

  async unblockUser(userId: number) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Traccar não configurado');
    }

    // For 4.15, ensure we have a valid session
    if (this.version === '4.15' && !this.sessionCookie) {
      await this.authenticateV415();
    }

    const authHeaders = this.authMethod === 'session'
      ? { 'Content-Type': 'application/json', 'Cookie': this.sessionCookie || '' }
      : { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };

    // First, get the current user data
    let getResponse = await fetch(`${this.baseUrl}/api/users/${userId}`, { headers: authHeaders });

    // If 401 on session auth, re-authenticate and retry
    if (!getResponse.ok && getResponse.status === 401 && this.authMethod === 'session') {
      this.sessionCookie = null;
      await this.authenticateV415();
      const newHeaders = { 'Content-Type': 'application/json', 'Cookie': this.sessionCookie || '' };
      getResponse = await fetch(`${this.baseUrl}/api/users/${userId}`, { headers: newHeaders });
    }

    if (!getResponse.ok) {
      throw new Error(`Erro ao buscar dados do usuário: ${getResponse.statusText}`);
    }

    const user = await getResponse.json();

    // Update with disabled: false
    const response = await fetch(`${this.baseUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ ...user, disabled: false }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao desbloquear usuário: ${response.statusText}`);
    }

    return response.json();
  }
}
