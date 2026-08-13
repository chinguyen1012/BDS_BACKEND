import { createHmac, randomBytes } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type SepayTransaction = {
  id: string | number;
  transaction_date?: string;
  account_number?: string;
  amount_in?: string | number;
  amount_out?: string | number;
  transaction_content?: string | null;
  reference_number?: string | null;
  code?: string | null;
};

const SIGNED_FIELDS = [
  'merchant',
  'operation',
  'payment_method',
  'order_amount',
  'currency',
  'order_invoice_number',
  'order_description',
  'customer_id',
  'success_url',
  'error_url',
  'cancel_url',
] as const;

export type SepayCheckoutInput = {
  invoiceNumber: string;
  paymentCode: string;
  amount: number;
  description: string;
  customerId: string;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
};

@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey() {
    return this.config.get<string>('SEPAY_API_KEY') ?? '';
  }

  /** UserAPI base: Live = my.sepay.vn, Test = userapi-sandbox.sepay.vn. */
  get userApiUrl() {
    const custom = this.config.get<string>('SEPAY_USERAPI_URL');
    if (custom) return custom.replace(/\/$/, '');
    return this.isTestMode
      ? 'https://userapi-sandbox.sepay.vn'
      : 'https://my.sepay.vn';
  }

  private get merchantId() {
    return this.config.get<string>('SEPAY_MERCHANT_ID') ?? 'sandbox';
  }

  private get secretKey() {
    return this.config.get<string>('SEPAY_SECRET_KEY') ?? 'sandbox';
  }

  get checkoutUrl() {
    const env = this.config.get<string>('SEPAY_ENV') ?? 'sandbox';
    return env === 'production'
      ? 'https://pay.sepay.vn/v1/checkout/init'
      : 'https://pay-sandbox.sepay.vn/v1/checkout/init';
  }

  get isTestMode() {
    const mode = this.config.get<string>('SEPAY_MODE');
    if (mode) return mode === 'test';
    const env = this.config.get<string>('SEPAY_ENV') ?? 'sandbox';
    return env !== 'production';
  }

  get isSimulateMode() {
    return (
      this.config.get<string>('SEPAY_SIMULATE') === 'true' ||
      !this.config.get<string>('SEPAY_MERCHANT_ID')
    );
  }

  get paymentPrefix() {
    return this.config.get<string>('SEPAY_PAYMENT_PREFIX') ?? 'BDS';
  }

  get bankAccount() {
    return this.config.get<string>('SEPAY_BANK_ACCOUNT') ?? '';
  }

  get bankName() {
    return this.config.get<string>('SEPAY_BANK_NAME') ?? 'Vietcombank';
  }

  /**
   * Tạo URL ảnh QR (VietQR qua SePay) để quét chuyển khoản.
   * Nội dung CK = paymentCode để webhook nhận diện đúng đơn.
   */
  buildQrUrl(paymentCode: string, amount: number): string | null {
    if (!this.bankAccount) return null;
    const params = new URLSearchParams({
      acc: this.bankAccount,
      bank: this.bankName,
      amount: String(Math.round(amount)),
      des: paymentCode,
      template: 'compact',
    });
    return `https://qr.sepay.vn/img?${params.toString()}`;
  }

  /** Tạo mã thanh toán: BDS + 6 chữ số (khớp cấu hình SePay Test mode). */
  createPaymentCode(): string {
    const digits = Math.floor(100000 + Math.random() * 900000);
    return `${this.paymentPrefix}${digits}`;
  }

  signFields(fields: Record<string, string>): string {
    const signed = SIGNED_FIELDS.filter((field) => fields[field] !== undefined)
      .map((field) => `${field}=${fields[field] ?? ''}`)
      .join(',');

    return Buffer.from(
      createHmac('sha256', this.secretKey).update(signed).digest(),
    ).toString('base64');
  }

  buildCheckout(input: SepayCheckoutInput) {
    const fields: Record<string, string> = {
      merchant: this.merchantId,
      currency: 'VND',
      order_amount: String(Math.round(input.amount)),
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_description: `${input.paymentCode} ${input.description}`,
      order_invoice_number: input.invoiceNumber,
      customer_id: input.customerId,
      success_url: input.successUrl,
      error_url: input.errorUrl,
      cancel_url: input.cancelUrl,
    };

    fields.signature = this.signFields(fields);

    return {
      checkoutUrl: this.checkoutUrl,
      fields,
      simulate: this.isSimulateMode,
      qrUrl: this.buildQrUrl(input.paymentCode, input.amount),
      bankAccount: this.bankAccount,
      bankName: this.bankName,
    };
  }

  createInvoice(prefix: string) {
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${Date.now()}-${suffix}`;
  }

  /**
   * Gọi SePay UserAPI lấy giao dịch gần nhất (tiền vào) để đối soát
   * khi webhook không tới được server (vd: dev localhost).
   */
  async fetchTransactions(limit = 50): Promise<SepayTransaction[]> {
    if (!this.apiKey) {
      this.logger.warn('SEPAY_API_KEY chưa cấu hình - bỏ qua đối soát API');
      return [];
    }

    try {
      const res = await axios.get<{ transactions?: SepayTransaction[] }>(
        `${this.userApiUrl}/userapi/transactions/list`,
        {
          params: { limit },
          headers: { Authorization: `Bearer ${this.apiKey}` },
          timeout: 8000,
        },
      );
      return res.data?.transactions ?? [];
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? `${err.response?.status ?? ''} ${JSON.stringify(
            err.response?.data ?? err.message,
          )}`
        : String(err);
      this.logger.error(`Lỗi gọi SePay UserAPI: ${message}`);
      return [];
    }
  }

  /** Tìm giao dịch khớp mã thanh toán + đủ số tiền. */
  matchTransaction(
    transactions: SepayTransaction[],
    paymentCode: string,
    minAmount: number,
  ): SepayTransaction | null {
    const code = paymentCode.toUpperCase();
    return (
      transactions.find((tx) => {
        const content = [tx.code, tx.transaction_content]
          .filter(Boolean)
          .map((v) => String(v).toUpperCase())
          .join(' ');
        const amountIn = Number(tx.amount_in ?? 0);
        return content.includes(code) && amountIn >= minAmount;
      }) ?? null
    );
  }
}
