# ⚙️ Configuração do Ambiente

Guia completo para configurar o ambiente de desenvolvimento do PaySmart Backend.

## 📋 Pré-requisitos

### Software Necessário

- **Node.js**: 20.x ou superior
- **npm**: 9.x ou superior (vem com Node.js)
- **Docker**: 20.10+ (recomendado)
- **Docker Compose**: 2.0+ (recomendado)
- **Git**: Para versionamento

### Verificar Instalações

```bash
node --version    # Deve ser v20.x ou superior
npm --version     # Deve ser 9.x ou superior
docker --version  # Deve ser 20.10+
docker compose version  # Deve ser 2.0+
git --version
```

## 🚀 Configuração Inicial

### 1. Clonar Repositório

```bash
git clone <repository-url>
cd paysmart-backend
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/paysmart"
POSTGRES_USER=user
POSTGRES_PASSWORD=pass
POSTGRES_DB=paysmart

# Redis
REDIS_URL="redis://localhost:6379"
BULL_REDIS_URL="redis://localhost:6379"

# JWT Secrets (NUNCA commite estes valores!)
JWT_SECRET="paysmart-super-secret-jwt-key-development"
JWT_REFRESH_SECRET="paysmart-super-secret-refresh-key-development"

# App Configuration
NODE_ENV=development
PORT=3000
SOCKET_CORS_ORIGIN="*"

# URLs (opcional)
APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3001"

# Uploads
UPLOAD_DEST="./uploads"
MAX_FILE_SIZE=10485760
```

### 4. Gerar Cliente Prisma

```bash
npx prisma generate
```

### 5. Executar Migrações

```bash
npx prisma migrate dev
```

### 6. Popular Banco (Opcional)

```bash
npm run prisma:seed
```

## 🐳 Configuração com Docker (Recomendado)

### 1. Iniciar Serviços

```bash
docker compose up -d
```

Isso inicia:
- PostgreSQL na porta 5432
- Redis na porta 6379
- Aplicação NestJS na porta 3000

### 2. Executar Migrações no Container

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
```

### 3. Popular Banco

```bash
./run-seed.sh
```

## 🔧 Configuração Local (Sem Docker)

### 1. Instalar PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux:**
```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

**Windows:**
Baixe do [site oficial](https://www.postgresql.org/download/windows/)

### 2. Criar Banco de Dados

```bash
psql -U postgres
CREATE DATABASE paysmart;
CREATE USER user WITH PASSWORD 'pass';
GRANT ALL PRIVILEGES ON DATABASE paysmart TO user;
\q
```

### 3. Instalar Redis

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
Use WSL ou Docker para Redis

### 4. Atualizar .env

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/paysmart"
REDIS_URL="redis://localhost:6379"
```

### 5. Executar Aplicação

```bash
npm run start:dev
```

## 🧪 Verificar Instalação

### 1. Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Deve retornar:
```json
{
  "status": "ok",
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}
```

### 2. Swagger UI

Acesse: http://localhost:3000/api-docs

### 3. Testar Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+244987654321","pin":"1234"}'
```

## 🔍 Troubleshooting

### Erro: "Cannot connect to database"

**Com Docker:**
```bash
# Verificar se o container está rodando
docker compose ps db

# Ver logs
docker compose logs db
```

**Sem Docker:**
```bash
# Verificar se PostgreSQL está rodando
pg_isready

# Verificar conexão
psql -U user -d paysmart -h localhost
```

### Erro: "Cannot connect to Redis"

**Com Docker:**
```bash
docker compose ps cache
docker compose exec cache redis-cli ping
```

**Sem Docker:**
```bash
redis-cli ping  # Deve retornar PONG
```

### Erro: "Prisma Client not generated"

```bash
npx prisma generate
```

### Erro: "Migration failed"

```bash
# Resetar banco (CUIDADO: apaga todos os dados!)
npx prisma migrate reset

# Ou aplicar migrações manualmente
npx prisma migrate deploy
```

## 📝 Variáveis de Ambiente Detalhadas

### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão PostgreSQL | `postgresql://user:pass@localhost:5432/paysmart` |
| `REDIS_URL` | URL de conexão Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Secret para assinar tokens JWT | `your-secret-key` |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens | `your-refresh-secret` |

### Opcionais

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `NODE_ENV` | Ambiente (development/production) | `development` |
| `PORT` | Porta da aplicação | `3000` |
| `SOCKET_CORS_ORIGIN` | CORS para WebSocket | `*` |
| `APP_URL` | URL base da aplicação | `http://localhost:3000` |
| `FRONTEND_URL` | URL do frontend | `http://localhost:3001` |
| `UPLOAD_DEST` | Diretório de uploads | `./uploads` |
| `MAX_FILE_SIZE` | Tamanho máximo de arquivo (bytes) | `10485760` |

## 🔒 Segurança

### ⚠️ IMPORTANTE

- **NUNCA** commite o arquivo `.env` no Git
- Use `.env.example` como template
- Gere secrets únicos e fortes para produção
- Rotacione secrets periodicamente

### Gerar Secrets Seguros

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

## 📚 Próximos Passos

Após configurar o ambiente:

1. Leia o [Guia de Desenvolvimento](./development-guide.md)
2. Explore a [Documentação da API](../api/api-reference.md)
3. Consulte a [Análise Profunda](../architecture/analise-profunda.md)

---

Para mais informações, consulte o [README principal](../../README.md).

