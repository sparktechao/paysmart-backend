import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType, TRANSACTION_TYPE_REQUIREMENTS, Currency } from '../../common/enums/transaction.enum';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export interface TransactionValidationData {
  type: TransactionType;
  fromWalletId?: string;
  toWalletId?: string;
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  currency: string;
  description: string;
  pin: string;
  notes?: string;
  conditions?: string;
  recipients?: string[];
  scheduleDate?: Date;
  metadata?: Record<string, any>;
}

export class TransactionValidator {
  /**
   * Valida se todos os campos obrigatórios estão presentes baseado no tipo de transação
   */
  static validateRequiredFields(data: TransactionValidationData): void {
    const requirements = TRANSACTION_TYPE_REQUIREMENTS[data.type];
    
    if (!requirements) {
      throw new BadRequestException(`Tipo de transação '${data.type}' não é suportado`);
    }

    const missingFields: string[] = [];

    // Verificar campos obrigatórios
    for (const requiredField of requirements.required) {
      if (!data[requiredField as keyof TransactionValidationData]) {
        missingFields.push(requiredField);
      }
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Campos obrigatórios em falta para transação do tipo '${data.type}': ${missingFields.join(', ')}. ${requirements.description}`
      );
    }

    // Verificar se campos opcionais estão vazios quando não deveriam estar
    for (const optionalField of requirements.optional) {
      if (data[optionalField as keyof TransactionValidationData]) {
        throw new BadRequestException(
          `Campo '${optionalField}' não deve ser fornecido para transação do tipo '${data.type}'. ${requirements.description}`
        );
      }
    }
  }

  /**
   * Valida regras de negócio específicas
   */
  static validateBusinessRules(data: TransactionValidationData): void {
    // Validar valor mínimo
    if (data.amount <= 0) {
      throw new BadRequestException('Valor da transação deve ser maior que zero');
    }

    // Validar PIN
    if (!data.pin || data.pin.length < 4) {
      throw new BadRequestException('PIN deve ter pelo menos 4 caracteres');
    }

    // Validar descrição
    if (!data.description || data.description.trim().length === 0) {
      throw new BadRequestException('Descrição da transação é obrigatória');
    }

    // Validar moeda
    if (!Object.values(Currency).includes(data.currency as Currency)) {
      throw new BadRequestException(`Moeda '${data.currency}' não é suportada. Moedas válidas: ${Object.values(Currency).join(', ')}`);
    }

    // Validar que carteiras de origem e destino são diferentes para transferências
    if (data.type === TransactionType.TRANSFER && data.fromWalletId === data.toWalletId) {
      throw new BadRequestException('Carteira de origem e destino não podem ser iguais');
    }
  }

  /**
   * Valida existência e propriedade das carteiras
   */
  static async validateWallets(prisma: PrismaService, data: TransactionValidationData): Promise<void> {
    // Validar carteira de origem (se existir)
    if (data.fromWalletId) {
      const fromWallet = await prisma.wallet.findUnique({
        where: { id: data.fromWalletId },
        include: { user: true }
      });

      if (!fromWallet) {
        throw new NotFoundException('Carteira de origem não encontrada');
      }

      // Verificar se o usuário autenticado é dono da carteira de origem
      if (fromWallet.userId !== data.fromUserId) {
        throw new BadRequestException('Carteira de origem não pertence ao usuário autenticado');
      }
    }

    // Validar carteira de destino (se existir)
    if (data.toWalletId) {
      const toWallet = await prisma.wallet.findUnique({
        where: { id: data.toWalletId },
        include: { user: true }
      });

      if (!toWallet) {
        throw new NotFoundException('Carteira de destino não encontrada');
      }
    }
  }

  /**
   * Valida PIN do usuário
   */
  static async validateUserPin(prisma: PrismaService, walletId: string, pin: string): Promise<void> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });

    if (!wallet) {
      throw new BadRequestException('Carteira não encontrada');
    }

    const security = wallet.security as any;
    if (!security || !security.pin) {
      throw new BadRequestException('PIN não configurado na carteira');
    }

    const isPinValid = await bcrypt.compare(pin, security.pin);
    if (!isPinValid) {
      throw new BadRequestException('PIN incorreto');
    }
  }

  /**
   * Validação completa da transação
   */
  static validateTransaction(data: TransactionValidationData): void {
    this.validateRequiredFields(data);
    this.validateBusinessRules(data);
  }

  /**
   * Validação completa da transação com verificações de banco de dados
   */
  static async validateTransactionWithDatabase(
    prisma: PrismaService, 
    data: TransactionValidationData
  ): Promise<void> {
    this.validateTransaction(data);
    await this.validateWallets(prisma, data);
    
    // Só validar PIN se houver carteira de origem (não para DEPOSIT)
    if (data.fromWalletId) {
      await this.validateUserPin(prisma, data.fromWalletId, data.pin);
    }
  }
}