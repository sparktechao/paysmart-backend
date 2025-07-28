# PaySmart Premium - Backend API

## 🚀 Visão Geral

O **PaySmart Premium** é uma API revolucionária para carteira digital avançada voltada para o mercado angolano. Este backend incorpora funcionalidades inovadoras como:

- ✅ **Validação Peer-to-Peer**: Sistema de validação entre usuários
- ✅ **Pedidos de Pagamento com QR Code**: Geração automática de QR codes para pagamentos
- ✅ **Carteiras Multi-moeda e Compartilhadas**: Suporte a AOA, USD, EUR e carteiras compartilhadas
- ✅ **Gamificação e Analytics**: Sistema de recompensas e análises avançadas
- ✅ **Operações Tipo Smart Contract**: Transferências condicionais com confirmação manual
- ✅ **Transferências com Rateio Direto**: Divisão automática de valores em múltiplos destinatários
- ✅ **Sistema de Notificações em Tempo Real**: Via Socket.io
- ✅ **Detecção de Fraudes**: Sistema avançado de segurança

## 🏗️ Arquitetura

### Stack Tecnológico
- **Node.js 20+** com TypeScript
- **NestJS** - Framework principal
- **PostgreSQL** - Banco de dados principal
- **Redis** - Cache, sessões e filas
- **Prisma** - ORM type-safe
- **Socket.io** - Comunicação em tempo real
- **Bull Queue** - Processamento assíncrono
- **JWT** - Autenticação
- **Docker Compose** - Containerização

### Estrutura de Módulos
```
src/
├── common/           # Módulos compartilhados
│   ├── auth/        # Autenticação JWT
│   ├── prisma/      # Configuração do banco
│   └── dto/         # DTOs compartilhados
├── users/           # Gestão de usuários
├── wallets/         # Gestão de carteiras
├── transactions/    # Transações e pagamentos
├── payment-requests/ # Pedidos de pagamento
├── services/        # Pagamentos de serviços
├── notifications/   # Sistema de notificações
├── rewards/         # Sistema de recompensas
├── analytics/       # Analytics e relatórios
├── security/        # Segurança e detecção de fraudes
├── support/         # Suporte ao cliente
├── shared-wallets/  # Carteiras compartilhadas
├── smart-contracts/ # Operações tipo Smart Contract
└── rateio/          # Transferências com Rateio Direto
```

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 20+
- Docker e Docker Compose
- Git

### 1. Clone o Repositório
```bash
git clone <repository-url>
cd paysmart-backend
```

### 2. Configuração do Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar variáveis de ambiente
nano .env
```

### 3. Instalação com Docker (Recomendado)
```bash
# Construir e iniciar containers
docker-compose up -d

# Verificar logs
docker-compose logs -f app
```

### 4. Instalação Local (Desenvolvimento)
```bash
# Instalar dependências
npm install

# Gerar cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate dev

# Iniciar aplicação
npm run start:dev
```

## 📋 Variáveis de Ambiente

### Obrigatórias
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/paysmart"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
```

### Opcionais
```env
NODE_ENV="development"
PORT=3000
SOCKET_CORS_ORIGIN="*"
UPLOAD_DEST="./uploads"
MAX_FILE_SIZE=10485760
```

## 🔧 Comandos Úteis

### Desenvolvimento
```bash
# Iniciar em modo desenvolvimento
npm run start:dev

# Executar testes
npm run test

# Executar testes e2e
npm run test:e2e

# Linting
npm run lint

# Formatação
npm run format
```

### Banco de Dados
```bash
# Gerar cliente Prisma
npm run prisma:generate

# Executar migrações
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio

# Seed do banco
npm run prisma:seed
```

### Docker
```bash
# Construir containers
npm run docker:build

# Iniciar serviços
npm run docker:up

# Parar serviços
npm run docker:down

# Ver logs
npm run docker:logs
```

## 📚 Documentação da API

### Swagger UI
Após iniciar a aplicação, acesse:
```
http://localhost:3000/api-docs
```

### Endpoints Principais

#### Autenticação
- `POST /api/v1/auth/register` - Registrar usuário
- `POST /api/v1/auth/login` - Fazer login
- `POST /api/v1/auth/refresh` - Renovar token
- `POST /api/v1/auth/change-pin` - Alterar PIN

#### Usuários
- `GET /api/v1/users/profile` - Obter perfil
- `PUT /api/v1/users/profile` - Atualizar perfil
- `POST /api/v1/users/request-validation` - Solicitar validação
- `POST /api/v1/users/validate` - Validar usuário (premium)

#### Carteiras
- `GET /api/v1/wallets` - Listar carteiras
- `POST /api/v1/wallets` - Criar carteira
- `GET /api/v1/wallets/:id/balance` - Obter saldo

#### Transações
- `POST /api/v1/transactions` - Criar transação
- `GET /api/v1/transactions` - Listar transações
- `POST /api/v1/transactions/:id/confirm-condition` - Confirmar smart contract

#### Pedidos de Pagamento
- `POST /api/v1/payment-requests` - Criar pedido
- `GET /api/v1/payment-requests/:id/qr` - Gerar QR code
- `POST /api/v1/payment-requests/:id/pay` - Pagar pedido

## 🔐 Funcionalidades de Segurança

### Validação Peer-to-Peer
- Usuários básicos precisam de 2 validações de usuários premium
- Validadores recebem 50 AOA de recompensa
- Validações expiram em 7 dias

### Smart Contracts
- Transferências condicionais com confirmação manual
- Timeout automático configurável
- Suporte a múltiplas condições

### Rateio Direto
- Divisão automática de valores
- Suporte a pré-agendamento
- Transações atômicas

### Detecção de Fraudes
- Análise de padrões de transação
- Score de risco em tempo real
- Bloqueio automático de atividades suspeitas

## 📊 Analytics e Relatórios

### Métricas Disponíveis
- Volume de transações por período
- Padrões de uso por usuário
- Análise de fraudes
- Performance do sistema

### Dashboards
- Dashboard administrativo
- Relatórios personalizados
- Exportação de dados

## 🔄 Processamento Assíncrono

### Filas Bull Queue
- `validation-queue` - Processamento de validações
- `premium-upgrade-queue` - Verificação de elegibilidade premium
- `notification-queue` - Envio de notificações
- `smart-contract-queue` - Processamento de smart contracts
- `rateio-queue` - Processamento de rateios

## 🧪 Testes

### Executar Testes
```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Cobertura
npm run test:cov
```

### Estrutura de Testes
```
test/
├── unit/           # Testes unitários
├── integration/    # Testes de integração
└── e2e/           # Testes end-to-end
```

## 🚀 Deploy

### Produção com Docker
```bash
# Construir imagem de produção
docker build -t paysmart-backend:prod .

# Executar com variáveis de produção
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=... \
  -e REDIS_URL=... \
  paysmart-backend:prod
```

### Variáveis de Produção
```env
NODE_ENV=production
JWT_SECRET=<secret-ultra-seguro>
JWT_REFRESH_SECRET=<refresh-secret-ultra-seguro>
DATABASE_URL=<url-producao>
REDIS_URL=<redis-producao>
```

## 📈 Monitoramento

### Logs
- Winston para logging estruturado
- Rotação automática de logs
- Diferentes níveis por ambiente

### Métricas
- Health checks automáticos
- Métricas de performance
- Alertas configuráveis

## 🤝 Contribuição

### Padrões de Código
- ESLint + Prettier
- Conventional Commits
- TypeScript strict mode
- Testes obrigatórios

### Processo de Contribuição
1. Fork do repositório
2. Criar branch feature
3. Implementar funcionalidade
4. Adicionar testes
5. Submeter Pull Request

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).

## 🆘 Suporte

### Documentação
- [Guia de Desenvolvimento](docs/development.md)
- [Guia de API](docs/api.md)
- [Guia de Deploy](docs/deployment.md)

### Contato
- Email: support@paysmart.ao
- Issues: [GitHub Issues](https://github.com/paysmart/backend/issues)

---

**PaySmart Premium** - Revolucionando o mercado de carteiras digitais em Angola 🇦🇴
