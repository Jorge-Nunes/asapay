# 📦 Guia de Instalação - AsaPay

Sistema de Gestão de Cobranças com Integração Asaas, Evolution API e Traccar.

---

## 🔧 Requisitos Mínimos

### Software
- **Node.js**: v20.19.3 (recomendado) ou superior
- **npm**: v10.8.2 (recomendado) ou superior
- **Git**: Para clonar o repositório
- **PostgreSQL**: v12+ (banco de dados opcional, suporta em-memory por padrão)

### Variáveis de Ambiente
Você precisará das seguintes credenciais:
- `DATABASE_URL` - String de conexão PostgreSQL (opcional)
- `ASAAS_TOKEN` - Token de autenticação da API Asaas
- `ASAAS_URL` - URL base da API Asaas (padrão: `https://api.asaas.com/v3`)
- `EVOLUTION_URL` - URL da instância Evolution API
- `EVOLUTION_INSTANCE` - Nome da instância WhatsApp na Evolution
- `EVOLUTION_APIKEY` - API Key da Evolution API
- `TRACCAR_URL` - URL do servidor Traccar
- `TRACCAR_APIKEY` - API Key do Traccar
- `SESSION_SECRET` - Chave secreta para sessões (gerar uma aleatória)
- `NODE_ENV` - Ambiente (`development` ou `production`)

---

## 📥 Instalação

### 1. Clonar o Repositório
```bash
git clone <seu-repositorio>
cd <seu-projeto>
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Database (opcional - se não configurado, usa em-memory)
DATABASE_URL=postgresql://user:password@localhost:5432/asapay

# Asaas API
ASAAS_TOKEN=seu_token_asaas_aqui
ASAAS_URL=https://api.asaas.com/v3

# Evolution API (WhatsApp)
EVOLUTION_URL=https://seu-dominio-evolution.com
EVOLUTION_INSTANCE=seu_nome_instancia
EVOLUTION_APIKEY=sua_evolution_api_key

# Traccar API
TRACCAR_URL=https://seu-dominio-traccar.com
TRACCAR_APIKEY=sua_traccar_api_key

# Session Secret (gere uma string aleatória segura)
SESSION_SECRET=sua_chave_secreta_aqui_minimo_32_caracteres

# Ambiente
NODE_ENV=production
```

### 4. (Opcional) Configurar PostgreSQL

Se estiver usando PostgreSQL:

```bash
# Fazer push do schema para o banco
npm run db:push
```

---

## 🚀 Desenvolvimento Local

```bash
npm run dev
```

A aplicação estará disponível em: `http://localhost:5000`

---

## 🏗️ Build para Produção

```bash
npm run build
```

Isso vai:
1. Compilar o frontend com Vite
2. Fazer bundle do backend com esbuild
3. Gerar arquivos em `dist/`

---

## 🌐 Deploy no Servidor

### Via Node.js Direto

```bash
# 1. Instalar dependências
npm install --production

# 2. Fazer build
npm run build

# 3. Rodar em produção
npm start
```

A aplicação vai rodar na porta `5000` (frontend + backend).

### Via Docker (Opcional)

Crie um `Dockerfile` na raiz:

```dockerfile
FROM node:20.19.3-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 5000

ENV NODE_ENV=production

CMD ["npm", "start"]
```

Build e deploy:
```bash
docker build -t asapay:latest .
docker run -d \
  --name asapay \
  -p 5000:5000 \
  --env-file .env.production \
  asapay:latest
```

### Via PM2 (Recomendado para Linux/Mac)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Fazer build
npm run build

# Iniciar com PM2
pm2 start dist/index.js --name "asapay" --env production

# Ver logs
pm2 logs asapay

# Fazer reload em caso de mudanças
pm2 reload asapay

# Salvar configuração
pm2 save
```

### Via Nginx (Proxy Reverso Recomendado)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Para webhooks do Asaas (aumentar timeout)
    location /api/webhook/ {
        proxy_pass http://localhost:5000;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
}
```

---

## 🔗 Webhooks Asaas

Configure os webhooks no Asaas para apontarem para:

```
https://seu-dominio.com/api/webhook/asaas
```

Eventos necessários:
- ✅ `PAYMENT_CREATED`
- ✅ `PAYMENT_CONFIRMED`
- ✅ `PAYMENT_OVERDUE`
- ✅ `PAYMENT_DELETED`

---

## 📋 Scripts NPM Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia em desenvolvimento com hot-reload |
| `npm run build` | Build para produção |
| `npm start` | Inicia aplicação compilada |
| `npm run check` | Verifica tipos TypeScript |
| `npm run db:push` | Sincroniza schema com PostgreSQL |

---

## 🐛 Troubleshooting

### Porta 5000 já em uso
```bash
# Encontrar processo usando a porta
lsof -i :5000

# Matar o processo
kill -9 <PID>
```

### Erro de conexão PostgreSQL
- Verificar string `DATABASE_URL`
- Garantir que PostgreSQL está rodando
- Testar conexão: `psql $DATABASE_URL`

### Webhooks não chegando
- Verificar se URL é acessível externamente
- Verificar logs em tempo real: `npm run dev` e abrir console
- Validar token Asaas em `/api/config`

### Mensagens WhatsApp não sendo enviadas
- Verificar credenciais da Evolution API
- Validar nome da instância
- Testar conexão com Evolution antes

---

## 📝 Estrutura de Pasta

```
/
├── client/          # Frontend React + Vite
├── server/          # Backend Express + TypeScript
├── shared/          # Schemas e tipos compartilhados
├── dist/            # Build de produção (após npm run build)
├── package.json     # Dependências
├── tsconfig.json    # Configuração TypeScript
├── vite.config.ts   # Configuração Vite
└── drizzle.config.ts # Configuração ORM
```

---

## 🔒 Segurança em Produção

1. **Use HTTPS**: Sempre use certificados SSL/TLS (Let's Encrypt)
2. **CORS**: Configure origem correta em produção
3. **Secrets**: Nunca commite `.env` no git
4. **Headers**: Use helmet para segurança HTTP
5. **Rate Limiting**: Configure rate limit para APIs
6. **Logs**: Monitore logs e configure alertas

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação Asaas: https://docs.asaas.com
- Documentação Evolution API: https://evolution-api.gitbook.io
- Documentação Traccar: https://www.traccar.org/documentation

---

**Versão**: 1.0.0 | **Última atualização**: Novembro 2025
