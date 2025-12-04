# 🐳 Deploy com Docker

Guia completo para fazer deploy do PaySmart Backend usando Docker e Docker Compose.

## 📋 Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+
- Acesso ao servidor (se deploy remoto)

## 🚀 Deploy Local (Desenvolvimento)

### 1. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL="postgresql://user:pass@db:5432/paysmart"
POSTGRES_USER=user
POSTGRES_PASSWORD=pass
POSTGRES_DB=paysmart

# Redis
REDIS_URL="redis://cache:6379"
BULL_REDIS_URL="redis://cache:6379"

# JWT
JWT_SECRET="paysmart-super-secret-jwt-key-development"
JWT_REFRESH_SECRET="paysmart-super-secret-refresh-key-development"

# App
NODE_ENV=development
PORT=3000
SOCKET_CORS_ORIGIN="*"

# URLs (opcional)
APP_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3001"
```

### 2. Iniciar Serviços

```bash
# Construir e iniciar todos os serviços
docker compose up -d

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f app
```

### 3. Executar Migrações

```bash
# Executar migrações do Prisma
docker compose exec app npx prisma migrate deploy

# Gerar cliente Prisma
docker compose exec app npx prisma generate
```

### 4. Popular Banco de Dados (Opcional)

```bash
# Executar seed
./run-seed.sh

# Ou manualmente
docker compose exec app npm run prisma:seed
```

## 🌐 Deploy em Produção

### 1. Preparar Ambiente

```bash
# No servidor, clone o repositório
git clone <repository-url>
cd paysmart-backend

# Criar arquivo .env de produção
nano .env
```

### 2. Configuração de Produção

```env
# Database (use credenciais seguras)
DATABASE_URL="postgresql://user:strong_password@db:5432/paysmart"
POSTGRES_USER=user
POSTGRES_PASSWORD=strong_password_here
POSTGRES_DB=paysmart

# Redis
REDIS_URL="redis://cache:6379"
BULL_REDIS_URL="redis://cache:6379"

# JWT (GERE SECRETS ÚNICOS E SEGUROS!)
JWT_SECRET="generate-strong-random-secret-here"
JWT_REFRESH_SECRET="generate-strong-random-refresh-secret-here"

# App
NODE_ENV=production
PORT=3000
SOCKET_CORS_ORIGIN="https://app.paysmart.ao"

# URLs de Produção
APP_URL="https://api.paysmart.ao"
FRONTEND_URL="https://app.paysmart.ao"
```

### 3. Ajustar Docker Compose para Produção

Edite `docker-compose.yml` para produção:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod  # Usar Dockerfile de produção
    environment:
      NODE_ENV: production
    # Remover volumes de desenvolvimento
    # volumes:
    #   - ./src:/app/src
    command: npm run start:prod
```

### 4. Deploy

```bash
# Construir imagens
docker compose build

# Iniciar serviços
docker compose up -d

# Verificar saúde
docker compose ps
curl http://localhost:3000/api/v1/health
```

## 🔧 Comandos Úteis

### Gerenciamento de Containers

```bash
# Parar serviços
docker compose down

# Parar e remover volumes
docker compose down -v

# Reiniciar um serviço específico
docker compose restart app

# Ver logs em tempo real
docker compose logs -f app

# Executar comando no container
docker compose exec app sh
```

### Banco de Dados

```bash
# Acessar PostgreSQL
docker compose exec db psql -U user -d paysmart

# Backup do banco
docker compose exec db pg_dump -U user paysmart > backup.sql

# Restaurar backup
docker compose exec -T db psql -U user paysmart < backup.sql
```

### Redis

```bash
# Acessar Redis CLI
docker compose exec cache redis-cli

# Verificar conexão
docker compose exec cache redis-cli ping
```

## 🔒 Segurança em Produção

### 1. Secrets

- **NUNCA** commite o arquivo `.env` no Git
- Use secrets management (Docker Secrets, AWS Secrets Manager, etc.)
- Gere secrets únicos e fortes para produção

### 2. Firewall

```bash
# Permitir apenas portas necessárias
# 80 (HTTP) e 443 (HTTPS) para Nginx
# Bloquear acesso direto à porta 3000
```

### 3. SSL/TLS

Configure Nginx com certificados SSL:

```nginx
server {
    listen 443 ssl;
    server_name api.paysmart.ao;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://app:3000;
    }
}
```

## 📊 Monitoramento

### Health Checks

```bash
# Verificar saúde da aplicação
curl http://localhost:3000/api/v1/health

# Verificar saúde dos serviços
docker compose ps
```

### Logs

```bash
# Logs da aplicação
docker compose logs app --tail=100

# Logs de todos os serviços
docker compose logs --tail=100

# Logs em tempo real
docker compose logs -f
```

## 🔄 Atualizações

### Atualizar Aplicação

```bash
# 1. Fazer pull das mudanças
git pull origin main

# 2. Reconstruir imagens
docker compose build

# 3. Parar serviços antigos
docker compose down

# 4. Iniciar novos serviços
docker compose up -d

# 5. Executar migrações (se houver)
docker compose exec app npx prisma migrate deploy
```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Verificar logs
docker compose logs app

# Verificar variáveis de ambiente
docker compose exec app env | grep DATABASE_URL
```

### Erro de conexão com banco

```bash
# Verificar se o banco está rodando
docker compose ps db

# Testar conexão
docker compose exec app npx prisma db pull
```

### Erro de conexão com Redis

```bash
# Verificar Redis
docker compose ps cache
docker compose exec cache redis-cli ping
```

## 📝 Notas Importantes

- **Desenvolvimento**: Use `docker-compose.yml` com volumes montados
- **Produção**: Use `Dockerfile.prod` sem volumes, apenas código compilado
- **Secrets**: Nunca exponha secrets em logs ou código
- **Backups**: Configure backups regulares do banco de dados
- **Monitoramento**: Configure alertas para falhas de serviços

---

Para mais informações, consulte o [README principal](../README.md).

