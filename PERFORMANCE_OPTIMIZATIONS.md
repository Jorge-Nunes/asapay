# 🚀 Otimizações de Desempenho - AsaPay

## ✅ Implementadas (v1.0)

### 1. **Batch UPSERT (INSERT...ON CONFLICT)**
**Implementado em**: `server/storage.postgres.ts` → `syncClients()`

**Problema Anterior**:
- Loop iterativo: 1 SELECT + 1 INSERT/UPDATE = **N queries × 2**
- Exemplo: 2.000 clientes = **4.000 queries** 🐌

**Solução**:
```typescript
INSERT INTO clients (...) VALUES 
  (...), (...), (...)  // Todos de uma vez
ON CONFLICT (asaas_customer_id) DO UPDATE SET ...
```
- Uma única query para N clientes
- 2.000 clientes = **1 query** ⚡

**Impacto Estimado**:
- Antes: ~5-10 segundos para 2.000 clientes
- Depois: ~1-2 segundos para 2.000 clientes
- **Ganho**: 5-10x mais rápido 🎯

### 2. **COALESCE para Mapeamento Traccar**
**Mantém** valores existentes de `traccar_user_id` e `traccar_mapping_method` durante updates:
```sql
traccar_user_id = COALESCE(EXCLUDED.traccar_user_id, clients.traccar_user_id)
```

---

## 🔧 Próximas Otimizações (v2.0)

### 3. **Índices no Banco**
```sql
-- Acelera buscas durante sync
CREATE INDEX idx_clients_asaas_id ON clients(asaas_customer_id);
CREATE INDEX idx_cobrancas_asaas_payment_id ON cobrancas(asaas_payment_id);
CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);
```

### 4. **Batch Processing com Chunking**
Para APIs com limites de rate limiting:
```typescript
const BATCH_SIZE = 500; // Processar em lotes
for (let i = 0; i < clients.length; i += BATCH_SIZE) {
  const batch = clients.slice(i, i + BATCH_SIZE);
  await storage.syncClients(batch);
}
```

### 5. **Caching de Usuários Traccar**
Já está implementado em `routes.ts` (linhas 621-637):
- Busca usuários Traccar **uma vez**
- Usa em memória para todos os 2.000 clientes
- Sem múltiplas requests à API Traccar

### 6. **Query Selection no Asaas**
Atual: Busca **TODOS** os dados de cada cliente
Otimizado: Buscar apenas campos necessários:
```typescript
const query = {
  status: 'active', // Filtrar antes
  limit: 100,
  fields: ['id', 'name', 'email', 'mobilePhone'] // Apenas necessários
};
```

### 7. **Connection Pooling**
PostgreSQL automático via `postgres.js`, mas pode ser tuned:
```typescript
const client = postgres(process.env.DATABASE_URL, {
  max: 20, // Máximo de conexões simultâneas
  idle_timeout: 30, // Fechar conexões ociosas
});
```

### 8. **Parallelização com Promise.all()**
Buscar múltiplas coisas em paralelo:
```typescript
const [customers, payments, traccarUsers] = await Promise.all([
  asaasService.getCustomers(),
  asaasService.getPayments(),
  traccarService.getUsers()
]);
```

---

## 📊 Benchmark Estimado (2.000 clientes)

| Operação | Antes | Depois | Ganho |
|----------|-------|--------|-------|
| Sincronização | ~10s | ~2s | **5x** |
| Busca de Clientes | ~2s | ~500ms | **4x** |
| Atualização de Preferências | ~5s | ~1s | **5x** |

---

## 🎯 Roadmap

- [ ] v1.0: ✅ UPSERT (Implementado agora)
- [ ] v1.1: Índices no banco
- [ ] v1.2: Chunking para APIs
- [ ] v2.0: Caching distribuído (Redis)
- [ ] v2.1: GraphQL com DataLoader
