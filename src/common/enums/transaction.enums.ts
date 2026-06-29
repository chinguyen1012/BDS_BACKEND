export enum TransactionType {
  TOPUP = 'topup',
  SPEND = 'spend',
  REFUND = 'refund',
}

export enum TransactionStatus {
  SUCCESS = 'success',
  PENDING = 'pending',
  FAILED = 'failed',
}

export enum PaymentMethod {
  QR = 'qr',
  BANK = 'bank',
  ATM = 'atm',
  INTERNATIONAL = 'international',
  MOMO = 'momo',
  INSTALLMENT = 'installment',
  BALANCE = 'balance',
}
