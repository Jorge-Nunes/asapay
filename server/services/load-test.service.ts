import { format, addDays, subDays } from 'date-fns';

export interface LoadTestConfig {
  clientsCount: number;
  cobrancasPerClient: number;
}

export interface LoadTestResult {
  startTime: number;
  endTime: number;
  duration: number;
  stats: {
    totalClientsGenerated: number;
    totalCobrancasGenerated: number;
    avgCobrancasPerClient: number;
  };
  timing: {
    generationTime: number;
    insertionTime: number;
  };
}

const BRAZILIAN_STATES = ['SP', 'RJ', 'MG', 'BA', 'RS', 'PR', 'PE', 'CE', 'SC', 'GO', 'PB', 'MA', 'ES', 'PI', 'RN', 'AL', 'MT', 'MS', 'DF', 'AC', 'AM', 'AP', 'RO', 'RR', 'TO'];
const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Salvador', 'Fortaleza', 'Curitiba', 'Manaus', 'Recife', 'Belém', 'Porto Alegre', 'Goiânia', 'Guarulhos', 'Campinas', 'São Gonçalo'];
const COMPANY_NAMES = ['Tech Solutions', 'Digital Services', 'Cloud Computing', 'Data Analytics', 'Software House', 'Consultoria', 'Transportes', 'Logística', 'Importação', 'Comércio', 'Indústria', 'Agronegócio', 'Construção', 'Imóveis', 'Educação'];
const EXTENSIONS = ['com', 'com.br', 'net', 'org', 'net.br', 'gov.br'];

export class LoadTestService {
  static generateRandomPhone(): string {
    // Gera (11) 99999-9999
    const area = Math.floor(Math.random() * 90) + 11;
    const first = Math.floor(Math.random() * 90000) + 10000;
    const second = Math.floor(Math.random() * 9000) + 1000;
    return `${area}${first}${second}`;
  }

  static generateRandomEmail(name: string, index: number): string {
    const base = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const domain = EXTENSIONS[Math.floor(Math.random() * EXTENSIONS.length)];
    return `${base}-${index}@example.${domain}`;
  }

  static generateClients(count: number): any[] {
    const clients = [];
    for (let i = 0; i < count; i++) {
      const companyName = `${COMPANY_NAMES[Math.floor(Math.random() * COMPANY_NAMES.length)]} ${Math.floor(Math.random() * 10000)}`;
      const state = BRAZILIAN_STATES[Math.floor(Math.random() * BRAZILIAN_STATES.length)];
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];

      clients.push({
        asaasCustomerId: `asaas_${Math.random().toString(36).substr(2, 9)}`,
        name: companyName,
        email: this.generateRandomEmail(companyName, i),
        phone: this.generateRandomPhone(),
        mobilePhone: Math.random() > 0.1 ? this.generateRandomPhone() : '', // 90% com celular
        address: `Rua ${Math.floor(Math.random() * 10000)}, ${Math.floor(Math.random() * 9999)}`,
        city,
        state,
        postalCode: `${Math.floor(Math.random() * 90000) + 10000}-${Math.floor(Math.random() * 900) + 100}`,
        cpfCnpj: `${Math.floor(Math.random() * 99999999999999)
          .toString()
          .padStart(14, '0')}`,
      });
    }
    return clients;
  }

  static generateCobrancas(clientsCount: number, perClient: number): any[] {
    const cobrancas = [];
    const hoje = new Date();

    for (let i = 0; i < clientsCount; i++) {
      for (let j = 0; j < perClient; j++) {
        const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 a +30 dias
        const dueDate = addDays(hoje, daysOffset);

        const status = daysOffset < 0 ? 'OVERDUE' : daysOffset < 5 ? 'PENDING' : 'CONFIRMED';
        const value = (Math.random() * 9950 + 50).toFixed(2); // 50 a 10000

        cobrancas.push({
          id: `cob_${Math.random().toString(36).substr(2, 9)}`,
          customer: `asaas_${Math.random().toString(36).substr(2, 9)}`,
          customerName: `Customer ${i}-${j}`,
          customerPhone: this.generateRandomPhone(),
          value,
          dueDate: format(dueDate, 'yyyy-MM-dd'),
          status,
          invoiceUrl: `https://sandbox.asaas.com/i/${Math.random().toString(36).substr(2, 10)}`,
          description: `Invoice ${i}-${j}`,
          tipo: daysOffset < 0 ? 'atraso' : daysOffset === 0 ? 'vence_hoje' : 'aviso',
        });
      }
    }
    return cobrancas;
  }

  static async insertTestData(storage: any, config: LoadTestConfig): Promise<LoadTestResult> {
    const startTime = Date.now();

    console.log(`[LoadTest] Starting load test: ${config.clientsCount} clients, ${config.cobrancasPerClient} cobrancas per client`);

    // Generate data
    const generationStart = Date.now();
    const clients = this.generateClients(config.clientsCount);
    const cobrancas = this.generateCobrancas(config.clientsCount, config.cobrancasPerClient);
    const generationTime = Date.now() - generationStart;

    console.log(`[LoadTest] Data generation completed: ${generationTime}ms`);
    console.log(`[LoadTest] Generated: ${clients.length} clients, ${cobrancas.length} cobrancas`);

    // Insert data
    const insertionStart = Date.now();

    // Insert clients
    await storage.syncClients(clients);
    console.log(`[LoadTest] Clients inserted`);

    // Insert cobrancas
    for (const cobranca of cobrancas) {
      try {
        await storage.createCobranca(cobranca);
      } catch (e) {
        // Silently skip duplicates
      }
    }
    console.log(`[LoadTest] Cobrancas inserted`);

    const insertionTime = Date.now() - insertionStart;
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[LoadTest] Insertion completed: ${insertionTime}ms`);
    console.log(`[LoadTest] Total duration: ${duration}ms`);

    return {
      startTime,
      endTime,
      duration,
      stats: {
        totalClientsGenerated: clients.length,
        totalCobrancasGenerated: cobrancas.length,
        avgCobrancasPerClient: cobrancas.length / clients.length,
      },
      timing: {
        generationTime,
        insertionTime,
      },
    };
  }

  static async performanceTest(storage: any): Promise<any> {
    const results: any = {
      tests: {},
      summary: {},
    };

    // Test 1: Get all clients
    let start = Date.now();
    const clients = await storage.getClients();
    results.tests.getAllClients = {
      duration: Date.now() - start,
      count: clients.length,
    };
    console.log(`[LoadTest] Get all clients: ${results.tests.getAllClients.duration}ms`);

    // Test 2: Get all cobrancas
    start = Date.now();
    const cobrancas = await storage.getCobrancas();
    results.tests.getAllCobrancas = {
      duration: Date.now() - start,
      count: cobrancas.data?.length || 0,
    };
    console.log(`[LoadTest] Get all cobrancas: ${results.tests.getAllCobrancas.duration}ms`);

    // Test 3: Get dashboard metrics
    start = Date.now();
    const metrics = await storage.getDashboardMetrics();
    results.tests.getDashboardMetrics = {
      duration: Date.now() - start,
      data: metrics,
    };
    console.log(`[LoadTest] Get dashboard metrics: ${results.tests.getDashboardMetrics.duration}ms`);

    // Test 4: Search by status
    start = Date.now();
    const pending = await storage.getCobrancas({ status: 'PENDING' });
    results.tests.getCobrancasByStatus = {
      duration: Date.now() - start,
      count: pending.data?.length || 0,
    };
    console.log(`[LoadTest] Get cobrancas by status: ${results.tests.getCobrancasByStatus.duration}ms`);

    // Calculate summary
    results.summary = {
      totalClients: clients.length,
      totalCobrancas: cobrancas.data?.length || 0,
      avgQueryTime: Object.values(results.tests)
        .reduce((acc: any, test: any) => acc + test.duration, 0) / Object.keys(results.tests).length,
    };

    return results;
  }
}
