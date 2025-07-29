export enum TransactionType {
  TRANSFER = 'TRANSFER',
  PAYMENT = 'PAYMENT',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  RATEIO = 'RATEIO',
  SMART_CONTRACT = 'SMART_CONTRACT'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED'
}

export enum Currency {
  AOA = 'AOA',
  USD = 'USD',
  EUR = 'EUR'
}

// Tipos de transação que requerem campos específicos
export const TRANSACTION_TYPE_REQUIREMENTS = {
  [TransactionType.DEPOSIT]: {
    required: ['toWalletId', 'toUserId'],
    optional: ['fromWalletId', 'fromUserId'],
    description: 'Depósito - requer apenas carteira e usuário de destino'
  },
  [TransactionType.WITHDRAWAL]: {
    required: ['fromWalletId', 'fromUserId'],
    optional: ['toWalletId', 'toUserId'],
    description: 'Levantamento - requer apenas carteira e usuário de origem'
  },
  [TransactionType.TRANSFER]: {
    required: ['fromWalletId', 'toWalletId', 'fromUserId', 'toUserId'],
    optional: [],
    description: 'Transferência - requer carteiras e usuários de origem e destino'
  },
  [TransactionType.PAYMENT]: {
    required: ['fromWalletId', 'toWalletId', 'fromUserId', 'toUserId'],
    optional: [],
    description: 'Pagamento - requer carteiras e usuários de origem e destino'
  }
} as const;