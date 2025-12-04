# 📚 Documentação PaySmart Backend

Bem-vindo à documentação completa do PaySmart Backend. Esta documentação está organizada por categorias para facilitar a navegação.

## 📖 Índice

### 🏗️ Arquitetura
- [Análise Profunda do Projeto](./architecture/analise-profunda.md) - Análise técnica completa da arquitetura, stack tecnológico e estrutura do projeto

### 🚀 Deploy e Infraestrutura
- [Instruções de Migração](./deployment/migration-instructions.md) - Guia para executar migrações do banco de dados
- [Deploy com Docker](./deployment/docker-deploy.md) - Guia completo de deploy usando Docker

### 💻 Desenvolvimento
- [Guia de Desenvolvimento](./development/development-guide.md) - Padrões de código, estrutura de módulos e boas práticas
- [Configuração do Ambiente](./development/environment-setup.md) - Configuração de variáveis de ambiente e dependências

### 🔌 API
- [Documentação da API](./api/api-reference.md) - Referência completa dos endpoints da API
- [WebSocket e Notificações](./api/websocket-notifications.md) - Guia de uso do WebSocket para notificações em tempo real

## 🗂️ Estrutura de Documentação

```
docs/
├── README.md                    # Este arquivo (índice)
├── architecture/                # Documentação de arquitetura
│   └── analise-profunda.md
├── deployment/                  # Documentação de deploy
│   ├── migration-instructions.md
│   └── docker-deploy.md
├── development/                 # Documentação de desenvolvimento
│   ├── development-guide.md
│   └── environment-setup.md
└── api/                        # Documentação da API
    ├── api-reference.md
    └── websocket-notifications.md
```

## 🔍 Documentação Rápida

### Para Desenvolvedores
1. Comece com [Guia de Desenvolvimento](./development/development-guide.md)
2. Configure o ambiente com [Configuração do Ambiente](./development/environment-setup.md)
3. Consulte [Análise Profunda](./architecture/analise-profunda.md) para entender a arquitetura

### Para DevOps
1. Veja [Deploy com Docker](./deployment/docker-deploy.md) para configuração de produção
2. Consulte [Instruções de Migração](./deployment/migration-instructions.md) para atualizações do banco

### Para Integradores
1. Acesse [Documentação da API](./api/api-reference.md) para endpoints
2. Veja [WebSocket e Notificações](./api/websocket-notifications.md) para integração em tempo real

## 📝 Documentação Adicional

- **Swagger UI**: Acesse `http://localhost:3000/api-docs` quando a aplicação estiver rodando
- **README Principal**: Veja o [README.md](../README.md) na raiz do projeto para visão geral rápida

## 🔄 Atualizações

Esta documentação é mantida junto com o código. Se encontrar informações desatualizadas, por favor abra uma issue ou submeta um PR.

---

**Última atualização**: Dezembro 2024

