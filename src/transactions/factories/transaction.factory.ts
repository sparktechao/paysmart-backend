import { TransactionType } from '../../common/enums/transaction.enum';
import { TransactionValidator, TransactionValidationData } from '../validators/transaction.validator';

export interface TransactionData {
  reference: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  status: string;
  fromWalletId?: string | null;
  toWalletId?: string | null;
  fromUserId?: string | null;
  toUserId?: string | null;
  notes?: string;
  conditions?: string;
  recipients?: string[];
  scheduleDate?: Date;
  metadata?: Record<string, any>;
}

export class TransactionFactory {
  /**
   * Cria dados de transação baseado no tipo e dados fornecidos
   */
  static createTransactionData(
    type: TransactionType,
    data: Partial<TransactionValidationData>,
    reference: string
  ): TransactionData {
    // Validar dados de entrada
    const validationData: TransactionValidationData = {
      type,
      fromWalletId: data.fromWalletId,
      toWalletId: data.toWalletId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amount: data.amount!,
      currency: data.currency!,
      description: data.description!,
      pin: data.pin!
    };

    TransactionValidator.validateTransaction(validationData);

    // Construir objeto base
    const transactionData: TransactionData = {
      reference,
      type,
      amount: validationData.amount,
      currency: validationData.currency,
      description: validationData.description,
      status: 'PROCESSING',
      metadata: data.metadata || {}
    };

    // Adicionar campos baseado no tipo de transação
    switch (type) {
      case TransactionType.DEPOSIT:
        transactionData.toWalletId = validationData.toWalletId;
        transactionData.toUserId = validationData.toUserId;
        transactionData.fromWalletId = null;
        transactionData.fromUserId = null;
        break;

      case TransactionType.WITHDRAWAL:
        transactionData.fromWalletId = validationData.fromWalletId;
        transactionData.fromUserId = validationData.fromUserId;
        transactionData.toWalletId = null;
        transactionData.toUserId = null;
        break;

      case TransactionType.TRANSFER:
      case TransactionType.PAYMENT:
        transactionData.fromWalletId = validationData.fromWalletId;
        transactionData.toWalletId = validationData.toWalletId;
        transactionData.fromUserId = validationData.fromUserId;
        transactionData.toUserId = validationData.toUserId;
        break;

      default:
        throw new Error(`Tipo de transação '${type}' não implementado no factory`);
    }

    // Adicionar campos opcionais
    if (data.notes) transactionData.notes = data.notes;
    if (data.conditions) transactionData.conditions = data.conditions;
    if (data.recipients) transactionData.recipients = data.recipients;
    if (data.scheduleDate) transactionData.scheduleDate = data.scheduleDate;

    return transactionData;
  }

  /**
   * Gera referência única para transação
   */
  static generateReference(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TXN${timestamp}${random}`;
  }
}