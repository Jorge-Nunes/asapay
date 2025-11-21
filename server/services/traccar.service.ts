import type { Config } from "@shared/schema";

export class TraccarService {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.traccarUrl || '';
    this.apiKey = config.traccarApiKey || '';
  }

  async getUsers() {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Traccar não configurado');
    }

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

  async blockUser(userId: number) {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error('Traccar não configurado');
    }

    const response = await fetch(`${this.baseUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ disabled: true }),
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

    const response = await fetch(`${this.baseUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ disabled: false }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao desbloquear usuário: ${response.statusText}`);
    }

    return response.json();
  }
}
