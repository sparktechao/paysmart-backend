import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar banco de dados
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Criar usuários de teste
  const hashedPin = await bcrypt.hash('1234', 12);

  // Usuário básico
  const basicUser = await prisma.user.create({
    data: {
      phone: '+244123456789',
      email: 'basic@test.com',
      firstName: 'João',
      lastName: 'Silva',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      documentType: 'BI',
      documentNumber: '123456789',
      documentExpiry: new Date('2030-01-01'),
      userType: 'BASIC',
      status: 'PENDING',
      validationScore: 0,
      validators: [],
    },
  });

  // Usuários premium (validadores)
  const premiumUser1 = await prisma.user.create({
    data: {
      phone: '+244987654321',
      email: 'premium1@test.com',
      firstName: 'Maria',
      lastName: 'Santos',
      dateOfBirth: new Date('1985-05-15'),
      gender: 'FEMALE',
      documentType: 'BI',
      documentNumber: '987654321',
      documentExpiry: new Date('2030-01-01'),
      userType: 'PREMIUM',
      status: 'ACTIVE',
      validationScore: 10,
      validators: [],
    },
  });

  const premiumUser2 = await prisma.user.create({
    data: {
      phone: '+244555666777',
      email: 'premium2@test.com',
      firstName: 'Pedro',
      lastName: 'Oliveira',
      dateOfBirth: new Date('1988-12-20'),
      gender: 'MALE',
      documentType: 'PASSPORT',
      documentNumber: 'PP123456',
      documentExpiry: new Date('2030-01-01'),
      userType: 'PREMIUM',
      status: 'ACTIVE',
      validationScore: 15,
      validators: [],
    },
  });

  // Usuário admin
  const adminUser = await prisma.user.create({
    data: {
      phone: '+244111222333',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'Sistema',
      dateOfBirth: new Date('1980-01-01'),
      gender: 'MALE',
      documentType: 'BI',
      documentNumber: 'ADMIN123',
      documentExpiry: new Date('2030-01-01'),
      userType: 'ADMIN',
      status: 'ACTIVE',
      validationScore: 0,
      validators: [],
    },
  });

  // Criar carteiras para os usuários
  const basicWallet = await prisma.wallet.create({
    data: {
      userId: basicUser.id,
      walletNumber: 'PS1234567890',
      balances: { AOA: 1000, USD: 0, EUR: 0 },
      limits: {
        dailyTransfer: 50000,
        monthlyTransfer: 500000,
        maxBalance: 1000000,
        minBalance: 0,
      },
      security: {
        pin: hashedPin,
        biometricEnabled: false,
        twoFactorEnabled: false,
        lastPinChange: new Date(),
      },
      isDefault: true,
    },
  });

  const premiumWallet1 = await prisma.wallet.create({
    data: {
      userId: premiumUser1.id,
      walletNumber: 'PS9876543210',
      balances: { AOA: 5000, USD: 100, EUR: 50 },
      limits: {
        dailyTransfer: 100000,
        monthlyTransfer: 1000000,
        maxBalance: 5000000,
        minBalance: 0,
      },
      security: {
        pin: hashedPin,
        biometricEnabled: true,
        twoFactorEnabled: false,
        lastPinChange: new Date(),
      },
      isDefault: true,
    },
  });

  const premiumWallet2 = await prisma.wallet.create({
    data: {
      userId: premiumUser2.id,
      walletNumber: 'PS5556667770',
      balances: { AOA: 3000, USD: 50, EUR: 25 },
      limits: {
        dailyTransfer: 100000,
        monthlyTransfer: 1000000,
        maxBalance: 5000000,
        minBalance: 0,
      },
      security: {
        pin: hashedPin,
        biometricEnabled: false,
        twoFactorEnabled: true,
        lastPinChange: new Date(),
      },
      isDefault: true,
    },
  });

  const adminWallet = await prisma.wallet.create({
    data: {
      userId: adminUser.id,
      walletNumber: 'PS1112223330',
      balances: { AOA: 10000, USD: 500, EUR: 250 },
      limits: {
        dailyTransfer: 1000000,
        monthlyTransfer: 10000000,
        maxBalance: 10000000,
        minBalance: 0,
      },
      security: {
        pin: hashedPin,
        biometricEnabled: true,
        twoFactorEnabled: true,
        lastPinChange: new Date(),
      },
      isDefault: true,
    },
  });

  // Criar algumas transações de exemplo
  const transaction1 = await prisma.transaction.create({
    data: {
      reference: 'TXN1234567890123',
      fromWalletId: premiumWallet1.id,
      toWalletId: basicWallet.id,
      fromUserId: premiumUser1.id,
      toUserId: basicUser.id,
      type: 'TRANSFER',
      amount: 500,
      currency: 'AOA',
      description: 'Transferência de teste',
      notes: 'Transação criada durante o seed',
      status: 'COMPLETED',
      processedAt: new Date(),
      completedAt: new Date(),
    },
  });

  const transaction2 = await prisma.transaction.create({
    data: {
      reference: 'TXN9876543210987',
      fromWalletId: premiumWallet2.id,
      toWalletId: basicWallet.id,
      fromUserId: premiumUser2.id,
      toUserId: basicUser.id,
      type: 'TRANSFER',
      amount: 300,
      currency: 'AOA',
      description: 'Outra transferência de teste',
      notes: 'Transação criada durante o seed',
      status: 'COMPLETED',
      processedAt: new Date(),
      completedAt: new Date(),
    },
  });

  // Criar algumas notificações de exemplo
  await prisma.notification.create({
    data: {
      userId: basicUser.id,
      type: 'PAYMENT_RECEIVED',
      title: 'Pagamento Recebido',
      message: 'Você recebeu 500 AOA de Maria Santos',
      data: {
        amount: 500,
        currency: 'AOA',
        senderName: 'Maria Santos',
        transactionId: transaction1.id,
      },
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: basicUser.id,
      type: 'PAYMENT_RECEIVED',
      title: 'Pagamento Recebido',
      message: 'Você recebeu 300 AOA de Pedro Oliveira',
      data: {
        amount: 300,
        currency: 'AOA',
        senderName: 'Pedro Oliveira',
        transactionId: transaction2.id,
      },
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  // Criar solicitações de validação
  await prisma.validation.create({
    data: {
      userId: basicUser.id,
      validatorId: premiumUser1.id,
      status: 'PENDING',
      notes: 'Solicitação criada durante o seed',
    },
  });

  await prisma.validation.create({
    data: {
      userId: basicUser.id,
      validatorId: premiumUser2.id,
      status: 'PENDING',
      notes: 'Solicitação criada durante o seed',
    },
  });

  console.log('✅ Seed concluído com sucesso!');
  console.log('\n📋 Dados criados:');
  console.log(`👥 Usuários: ${await prisma.user.count()}`);
  console.log(`💳 Carteiras: ${await prisma.wallet.count()}`);
  console.log(`💰 Transações: ${await prisma.transaction.count()}`);
  console.log(`🔔 Notificações: ${await prisma.notification.count()}`);
  console.log(`✅ Validações: ${await prisma.validation.count()}`);

  console.log('\n🔑 Credenciais de teste:');
  console.log('Usuário Básico: +244123456789 / 1234');
  console.log('Usuário Premium 1: +244987654321 / 1234');
  console.log('Usuário Premium 2: +244555666777 / 1234');
  console.log('Admin: +244111222333 / 1234');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 