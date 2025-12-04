# 💻 Guia de Desenvolvimento

Guia completo para desenvolvedores trabalhando no PaySmart Backend.

## 🏗️ Estrutura do Projeto

### Organização de Módulos

Cada módulo segue o padrão NestJS:

```
src/
├── {module-name}/
│   ├── {module-name}.controller.ts    # Endpoints da API
│   ├── {module-name}.service.ts      # Lógica de negócio
│   ├── {module-name}.module.ts       # Configuração do módulo
│   ├── dto/                          # Data Transfer Objects
│   │   └── {module-name}.dto.ts
│   └── {module-name}.controller.spec.ts  # Testes
```

### Módulos Principais

- **users**: Gestão de usuários e perfis
- **wallets**: Gestão de carteiras (PERSONAL, BUSINESS, MERCHANT)
- **transactions**: Processamento de transações
- **payment-requests**: Solicitações de pagamento e QR codes
- **notifications**: Sistema de notificações em tempo real
- **rewards**: Sistema de recompensas e gamificação
- **analytics**: Analytics e relatórios
- **security**: Detecção de fraudes e segurança
- **smart-contracts**: Transferências condicionais
- **rateio**: Transferências com divisão automática

## 📝 Padrões de Código

### Nomenclatura

- **Controllers**: `{Module}Controller` (ex: `UsersController`)
- **Services**: `{Module}Service` (ex: `UsersService`)
- **DTOs**: `{Action}{Entity}Dto` (ex: `CreateUserDto`, `UpdateWalletDto`)
- **Enums**: PascalCase (ex: `UserType`, `AccountType`)

### Estrutura de DTOs

```typescript
export class CreateUserDto {
  @ApiProperty({ description: 'Nome do usuário' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ description: 'Sobrenome' })
  @IsString()
  @MinLength(2)
  lastName: string;
}
```

### Estrutura de Services

```typescript
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createUser(data: CreateUserDto): Promise<UserResponseDto> {
    // Lógica aqui
  }
}
```

## 🔐 Autenticação e Autorização

### JWT Guards

```typescript
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  // Endpoints protegidos
}
```

### Extrair Usuário do Request

```typescript
@Get('profile')
async getProfile(@Req() req: Request) {
  const userId = req.user['id']; // Do JWT token
  return this.usersService.findById(userId);
}
```

## 🗄️ Trabalhando com Prisma

### Queries Básicas

```typescript
// Buscar um registro
const user = await this.prisma.user.findUnique({
  where: { id: userId }
});

// Buscar múltiplos
const users = await this.prisma.user.findMany({
  where: { status: 'ACTIVE' },
  take: 10,
  skip: 0
});

// Criar
const newUser = await this.prisma.user.create({
  data: { ... }
});

// Atualizar
const updated = await this.prisma.user.update({
  where: { id },
  data: { ... }
});
```

### Transações

```typescript
await this.prisma.$transaction(async (prisma) => {
  // Operações atômicas aqui
  await prisma.wallet.update({ ... });
  await prisma.transaction.create({ ... });
});
```

## 🔔 Notificações

### Criar Notificação

```typescript
await this.notificationsService.createNotification({
  userId: targetUserId,
  type: NotificationType.PAYMENT_REQUEST,
  title: 'Nova Solicitação',
  message: 'Você recebeu uma solicitação de pagamento',
  data: { paymentRequestId: '...' }
});
```

### Enviar via WebSocket

O sistema automaticamente envia notificações via WebSocket quando criadas. O gateway gerencia as salas `user:{userId}`.

## 🧪 Testes

### Estrutura de Testes

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // Setup
  });

  it('should create a user', async () => {
    // Teste
  });
});
```

### Executar Testes

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Cobertura
npm run test:cov
```

## 🔄 Migrações do Banco

### Criar Migração

```bash
npx prisma migrate dev --name description_of_change
```

### Aplicar Migrações

```bash
# Desenvolvimento
npx prisma migrate dev

# Produção
npx prisma migrate deploy
```

## 📦 Dependências

### Adicionar Nova Dependência

```bash
# Produção
npm install package-name

# Desenvolvimento
npm install -D package-name
```

### Atualizar Dependências

```bash
npm update
npm audit fix
```

## 🐛 Debugging

### Logs

```typescript
// Usar Logger do NestJS
private readonly logger = new Logger(ServiceName.name);

this.logger.log('Mensagem informativa');
this.logger.debug('Debug detalhado');
this.logger.warn('Aviso');
this.logger.error('Erro', error.stack);
```

### Debug no VS Code

Crie `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 🔍 Code Review Checklist

- [ ] Código segue os padrões do projeto
- [ ] DTOs têm validações adequadas
- [ ] Logs apropriados adicionados
- [ ] Tratamento de erros implementado
- [ ] Testes adicionados/atualizados
- [ ] Documentação Swagger atualizada
- [ ] Migrações do banco (se necessário)
- [ ] Performance considerada (queries otimizadas)

## 📚 Recursos Adicionais

- [Documentação NestJS](https://docs.nestjs.com/)
- [Documentação Prisma](https://www.prisma.io/docs)
- [Documentação Socket.io](https://socket.io/docs/v4/)

---

Para mais informações, consulte a [Análise Profunda](../architecture/analise-profunda.md).

