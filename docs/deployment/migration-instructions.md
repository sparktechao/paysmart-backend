# Instruções para Executar a Migration

## Passo 1: Gerar a Migration

Execute o seguinte comando para criar a migration:

```bash
npx prisma migrate dev --name separate_account_type_from_user_type
```

Este comando irá:
1. Criar o enum `AccountType` no banco de dados
2. Adicionar a coluna `accountType` na tabela `wallets` com valor padrão `PERSONAL`
3. Adicionar as colunas `businessInfo` e `merchantInfo` (nullable)
4. Remover `BUSINESS` do enum `UserType`

## Passo 2: Migrar Dados Existentes (Opcional)

Se você tem dados existentes no banco, execute o seguinte SQL para migrar usuários com `userType = 'BUSINESS'`:

```sql
-- Atualizar carteiras existentes de usuários BUSINESS para accountType = BUSINESS
UPDATE wallets
SET "accountType" = 'BUSINESS'
WHERE "userId" IN (
  SELECT id FROM users WHERE "userType" = 'BUSINESS'
);

-- Se não houver carteira para usuários BUSINESS, criar uma
INSERT INTO wallets (
  id, "userId", "walletNumber", "accountType", balances, limits, status, "isDefault", security, "createdAt", "updatedAt"
)
SELECT 
  gen_random_uuid(),
  u.id,
  'PS' || LPAD(FLOOR(RANDOM() * 10000000000)::text, 10, '0'),
  'BUSINESS',
  '{"AOA": 0, "USD": 0, "EUR": 0}'::jsonb,
  '{"dailyTransfer": 500000, "monthlyTransfer": 5000000, "maxBalance": 10000000, "minBalance": 0}'::jsonb,
  'ACTIVE',
  true,
  '{"pin": "", "biometricEnabled": false, "twoFactorEnabled": false, "lastPinChange": "2024-01-01T00:00:00Z"}'::jsonb,
  NOW(),
  NOW()
FROM users u
WHERE u."userType" = 'BUSINESS'
AND NOT EXISTS (
  SELECT 1 FROM wallets w WHERE w."userId" = u.id
);
```

## Passo 3: Regenerar o Cliente Prisma

Após a migration, regenere o cliente Prisma:

```bash
npx prisma generate
```

## Passo 4: Verificar

Execute o seed para verificar se tudo está funcionando:

```bash
npm run prisma:seed
```

## Notas Importantes

- A migration é **destrutiva** para o enum `UserType` - o valor `BUSINESS` será removido
- Certifique-se de fazer backup do banco antes de executar a migration
- Se você tem dados em produção, execute a migration em um ambiente de teste primeiro

