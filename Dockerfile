FROM node:20-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    openssl \
    openssl-dev \
    postgresql-client

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas as dependências (incluindo dev)
RUN npm ci && npm cache clean --force

# Gerar cliente Prisma
RUN npx prisma generate

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p uploads logs && \
    chown -R node:node /app

# Definir permissões
USER node

# Expor porta
EXPOSE 3000

# Comando padrão (será sobrescrito pelo docker-compose se necessário)
CMD ["npm", "run", "start:dev"] 