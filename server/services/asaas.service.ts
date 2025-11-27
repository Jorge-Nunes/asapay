import axios, { type AxiosInstance } from 'axios';
import type { Cliente, Cobranca } from '@shared/schema';

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  mobilePhone: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  dueDate: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE';
  invoiceUrl: string;
  description: string;
}

interface AsaasListResponse<T> {
  data: T[];
  hasMore: boolean;
  totalCount: number;
}

export class AsaasService {
  private client: AxiosInstance;

  constructor(apiUrl: string, apiToken: string) {
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'accept': 'application/json',
        'access_token': apiToken,
      },
    });
  }

  async getAllCustomers(): Promise<Cliente[]> {
    const customers: Cliente[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<AsaasListResponse<AsaasCustomer>>('/customers', {
          params: { limit, offset },
        });

        customers.push(...response.data.data.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          mobilePhone: c.mobilePhone,
        })));

        hasMore = response.data.hasMore;
        offset += limit;

        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error('Error fetching customers from Asaas:', error);
        throw error;
      }
    }

    return customers;
  }

  async getCustomersUpdatedSince(sinceTimestamp: number): Promise<Cliente[]> {
    // Convert timestamp to ISO date string for Asaas API
    const sinceDate = new Date(sinceTimestamp).toISOString().split('T')[0];
    const customers: Cliente[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<AsaasListResponse<AsaasCustomer>>('/customers', {
          params: { 
            limit, 
            offset,
            sort: '-updatedAt'  // Sort by updated date descending
          },
        });

        // Filter customers updated since the given date
        const newCustomers = response.data.data
          .filter(c => {
            // Only include if updatedAt is not available, we sync everything
            // Asaas doesn't provide updatedAt in customer list, so we'll sync all
            return true;
          })
          .map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            mobilePhone: c.mobilePhone,
          }));

        customers.push(...newCustomers);

        hasMore = response.data.hasMore;
        offset += limit;

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error('Error fetching updated customers from Asaas:', error);
        throw error;
      }
    }

    return customers;
  }

  async getPendingPayments(): Promise<AsaasPayment[]> {
    const payments: AsaasPayment[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<AsaasListResponse<AsaasPayment>>('/payments', {
          params: { 
            limit, 
            offset,
            status: 'PENDING',
          },
        });

        payments.push(...response.data.data);

        hasMore = response.data.hasMore;
        offset += limit;

        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error('Error fetching payments from Asaas:', error);
        throw error;
      }
    }

    return payments;
  }

  async enrichPaymentsWithCustomers(
    payments: AsaasPayment[], 
    customers: Cliente[]
  ): Promise<Cobranca[]> {
    const customerMap = new Map(customers.map(c => [c.id, c]));

    return payments.map(payment => {
      const customer = customerMap.get(payment.customer);
      
      // Keep dueDate as-is from Asaas (YYYY-MM-DD format is already in São Paulo timezone)
      // Do NOT convert to Date/ISO as it will cause timezone shift issues
      
      return {
        id: payment.id,
        customer: payment.customer,
        customerName: customer?.name || 'Cliente não encontrado',
        customerPhone: customer?.mobilePhone || customer?.phone || '',
        value: payment.value,
        dueDate: payment.dueDate,
        status: payment.status,
        invoiceUrl: payment.invoiceUrl,
        description: payment.description,
      };
    });
  }

  async getPaymentsByStatus(status: 'RECEIVED' | 'CONFIRMED' | 'PENDING' | 'OVERDUE'): Promise<AsaasPayment[]> {
    const payments: AsaasPayment[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<AsaasListResponse<AsaasPayment>>('/payments', {
          params: { limit, offset, status },
        });

        payments.push(...response.data.data);
        hasMore = response.data.hasMore;
        offset += limit;

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error fetching ${status} payments from Asaas:`, error);
        throw error;
      }
    }

    return payments;
  }

  async getAllPaymentIds(): Promise<string[]> {
    const paymentIds: string[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.get<AsaasListResponse<AsaasPayment>>('/payments', {
          params: { limit, offset },
        });

        paymentIds.push(...response.data.data.map(p => p.id));
        hasMore = response.data.hasMore;
        offset += limit;

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error fetching payment IDs from Asaas:', error);
        throw error;
      }
    }

    return paymentIds;
  }

  async getAllPayments(): Promise<AsaasPayment[]> {
    const allPayments: AsaasPayment[] = [];
    const statuses: Array<'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE'> = ['PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE'];

    // Fetch payments for each status separately
    for (const status of statuses) {
      const payments = await this.getPaymentsByStatus(status);
      allPayments.push(...payments);
      // Add delay between status requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allPayments;
  }
}
