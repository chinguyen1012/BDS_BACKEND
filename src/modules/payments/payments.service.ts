import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';

import {
  PaymentOrder,
  PaymentOrderDocument,
} from './schemas/payment-order.schema';
import { SepayService } from './sepay.service';
import {
  PaymentOrderStatus,
  PaymentPurpose,
} from '../../common/enums/payment.enums';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../common/enums/transaction.enums';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { ListingsService } from '../listings/listings.service';
import { CreateTopupPaymentDto } from './dto/create-topup-payment.dto';
import { CreateListingPaymentDto } from './dto/create-listing-payment.dto';
import { CreateListingDto } from '../listings/dto/create-listing.dto';
import { calcListingPrice } from '../../common/utils/listing-price.util';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.QR]: 'Mã QR Sepay',
  [PaymentMethod.BANK]: 'Chuyển khoản ngân hàng',
  [PaymentMethod.ATM]: 'Thẻ ATM nội địa',
  [PaymentMethod.INTERNATIONAL]: 'Thẻ quốc tế',
  [PaymentMethod.MOMO]: 'Ví MoMo',
  [PaymentMethod.INSTALLMENT]: 'Trả góp thẻ tín dụng',
  [PaymentMethod.BALANCE]: 'Số dư',
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(PaymentOrder.name)
    private readonly paymentOrderModel: Model<PaymentOrderDocument>,
    private readonly sepayService: SepayService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly listingsService: ListingsService,
    private readonly config: ConfigService,
  ) {}

  private callbackUrl(path: string) {
    const apiUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:9000/api';
    return `${apiUrl}/payments/callback/${path}`;
  }

  private frontendUrl(path: string) {
    const base =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return `${base}${path}`;
  }

  private buildCheckout(
    invoiceNumber: string,
    paymentCode: string,
    amount: number,
    description: string,
    userId: string,
  ) {
    return this.sepayService.buildCheckout({
      invoiceNumber,
      paymentCode,
      amount,
      description,
      customerId: userId,
      successUrl: this.frontendUrl(
        `/dashboard/payment/result?status=success&invoice=${invoiceNumber}`,
      ),
      errorUrl: this.frontendUrl(
        `/dashboard/payment/result?status=error&invoice=${invoiceNumber}`,
      ),
      cancelUrl: this.frontendUrl(
        `/dashboard/payment/result?status=cancel&invoice=${invoiceNumber}`,
      ),
    });
  }

  async createTopupPayment(userId: string, dto: CreateTopupPaymentDto) {
    const invoiceNumber = this.sepayService.createInvoice('TOPUP');
    const paymentCode = this.sepayService.createPaymentCode();
    const description = `Nạp tiền ${dto.amount.toLocaleString('vi-VN')}đ`;

    const transaction = await this.transactionsService.createPending({
      owner: userId,
      type: TransactionType.TOPUP,
      description: `Nạp tiền qua ${METHOD_LABELS[dto.method]}`,
      amount: dto.amount,
      method: dto.method,
      invoiceNumber,
    });

    const order = await this.paymentOrderModel.create({
      owner: new Types.ObjectId(userId),
      invoiceNumber,
      paymentCode,
      purpose: PaymentPurpose.TOPUP,
      status: PaymentOrderStatus.PENDING,
      payAmount: dto.amount,
      totalAmount: dto.amount,
      balanceUsed: 0,
      method: dto.method,
      transactionId: transaction._id,
      description,
    });

    const checkout = this.buildCheckout(
      invoiceNumber,
      paymentCode,
      dto.amount,
      description,
      userId,
    );

    const user = await this.usersService.findOne(userId);

    return {
      mode: 'sepay' as const,
      invoiceNumber,
      paymentCode,
      orderId: order._id,
      payAmount: dto.amount,
      totalAmount: dto.amount,
      balance: user.balance,
      balanceUsed: 0,
      checkout,
    };
  }

  async createListingPayment(userId: string, dto: CreateListingPaymentDto) {
    const totalAmount = calcListingPrice(dto.package, dto.duration ?? 7);
    const user = await this.usersService.findOne(userId);
    const balance = user.balance ?? 0;
    const balanceUsed = Math.min(balance, totalAmount);
    const payAmount = Math.max(0, totalAmount - balanceUsed);

    if (payAmount === 0) {
      return this.completeListingWithBalance(userId, dto, totalAmount, balanceUsed);
    }

    const invoiceNumber = this.sepayService.createInvoice('LISTING');
    const paymentCode = this.sepayService.createPaymentCode();
    const description = `Thanh toán đăng tin - ${dto.title}`;

    const transaction = await this.transactionsService.createPending({
      owner: userId,
      type: TransactionType.SPEND,
      description: `Đăng tin: ${dto.title}`,
      amount: -totalAmount,
      method: PaymentMethod.QR,
      invoiceNumber,
    });

    const listingDraft = { ...dto, owner: userId };

    const order = await this.paymentOrderModel.create({
      owner: new Types.ObjectId(userId),
      invoiceNumber,
      paymentCode,
      purpose: PaymentPurpose.LISTING,
      status: PaymentOrderStatus.PENDING,
      payAmount,
      totalAmount,
      balanceUsed,
      method: PaymentMethod.QR,
      transactionId: transaction._id,
      listingDraft,
      description,
    });

    const checkout = this.buildCheckout(
      invoiceNumber,
      paymentCode,
      payAmount,
      description,
      userId,
    );

    return {
      mode: 'sepay' as const,
      invoiceNumber,
      paymentCode,
      orderId: order._id,
      payAmount,
      totalAmount,
      balance,
      balanceUsed,
      checkout,
    };
  }

  private async completeListingWithBalance(
    userId: string,
    dto: CreateListingDto,
    totalAmount: number,
    balanceUsed: number,
  ) {
    if (balanceUsed > 0) {
      await this.transactionsService.spend(
        userId,
        balanceUsed,
        `Đăng tin: ${dto.title}`,
      );
    }

    const listing = await this.listingsService.create(
      {
        ...dto,
        owner: userId,
        status: totalAmount > 0 ? undefined : dto.status,
      },
      { paid: true },
    );

    const user = await this.usersService.findOne(userId);

    return {
      mode: 'balance' as const,
      listing,
      totalAmount,
      balanceUsed,
      payAmount: 0,
      balance: user.balance,
    };
  }

  async getOrderStatus(invoiceNumber: string, userId: string) {
    let order = await this.paymentOrderModel
      .findOne({ invoiceNumber, owner: new Types.ObjectId(userId) })
      .exec();

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn thanh toán');
    }

    // Đối soát chủ động với SePay khi webhook chưa tới (vd: dev localhost)
    if (order.status === PaymentOrderStatus.PENDING) {
      const changed = await this.syncFromSepay(order);
      if (changed) {
        order =
          (await this.paymentOrderModel.findById(order._id).exec()) ?? order;
      }
    }

    const user = await this.usersService.findOne(userId);

    return {
      invoiceNumber: order.invoiceNumber,
      paymentCode: order.paymentCode,
      status: order.status,
      purpose: order.purpose,
      payAmount: order.payAmount,
      totalAmount: order.totalAmount,
      balanceUsed: order.balanceUsed,
      balance: user.balance,
      listingId: order.listingId,
      transactionId: order.transactionId,
    };
  }

  /**
   * Đối soát đơn pending với SePay UserAPI (khi webhook không tới được server).
   * Trả về order đã cập nhật nếu khớp giao dịch, ngược lại null.
   */
  async syncFromSepay(order: PaymentOrderDocument): Promise<boolean> {
    const transactions = await this.sepayService.fetchTransactions();
    if (!transactions.length) return false;

    const matched = this.sepayService.matchTransaction(
      transactions,
      order.paymentCode,
      order.payAmount,
    );

    if (!matched) return false;

    this.logger.log(
      `Đối soát khớp ${order.paymentCode} với giao dịch SePay #${matched.id}`,
    );

    await this.completePayment(
      order.invoiceNumber,
      String(matched.id ?? matched.reference_number ?? `API-${Date.now()}`),
    );

    return true;
  }

  async handleIpn(payload: Record<string, unknown>) {
    const notificationType = payload.notification_type as string | undefined;
    if (notificationType !== 'ORDER_PAID') {
      return { received: true };
    }

    const orderData = payload.order as Record<string, unknown> | undefined;
    const transactionData = payload.transaction as
      | Record<string, unknown>
      | undefined;

    const invoiceNumber = orderData?.order_invoice_number as string | undefined;
    const txStatus = transactionData?.transaction_status as string | undefined;

    if (!invoiceNumber) {
      throw new BadRequestException('Thiếu order_invoice_number');
    }

    if (txStatus === 'APPROVED') {
      await this.completePayment(invoiceNumber, orderData?.id as string);
    } else {
      await this.failPayment(invoiceNumber);
    }

    return { success: true };
  }

  /**
   * Webhook SePay — giao dịch chuyển khoản / MoMo / VA.
   * URL: POST https://bdsapi.nvcn.id.vn/api/payment/webhook
   */
  async handleBankWebhook(body: Record<string, unknown>) {
    const payload = this.normalizeWebhookPayload(body);

    this.logger.log(
      `Webhook parsed: code=${payload.code} amount=${payload.transferAmount} type=${payload.transferType}`,
    );

    if (payload.transferType === 'out') {
      return { success: true, skipped: 'outgoing_transfer' };
    }

    if (!payload.code) {
      return { success: true, skipped: 'no_payment_code' };
    }

    const order = await this.findOrderByPaymentCode(payload.code);

    if (!order) {
      this.logger.warn(`Không tìm thấy đơn với mã ${payload.code}`);
      return { success: true, skipped: 'order_not_found', code: payload.code };
    }

    if (order.status === PaymentOrderStatus.SUCCESS) {
      return { success: true, skipped: 'already_paid', code: payload.code };
    }

    if (order.status !== PaymentOrderStatus.PENDING) {
      return { success: true, skipped: 'invalid_status', code: payload.code };
    }

    if (
      !Number.isFinite(payload.transferAmount) ||
      payload.transferAmount < order.payAmount
    ) {
      this.logger.warn(
        `Số tiền không đủ: cần ${order.payAmount}, nhận ${payload.transferAmount}`,
      );
      return {
        success: false,
        message: 'Số tiền chuyển khoản không đủ',
        code: payload.code,
        required: order.payAmount,
        received: payload.transferAmount,
      };
    }

    const sepayRef = String(payload.id ?? `WEBHOOK-${Date.now()}`);
    await this.completePayment(order.invoiceNumber, sepayRef);

    this.logger.log(
      `Đã xác nhận thanh toán ${order.invoiceNumber} (${payload.code})`,
    );

    return {
      success: true,
      code: payload.code,
      invoiceNumber: order.invoiceNumber,
    };
  }

  /** Chuẩn hóa payload SePay (JSON webhook / MoMo / API). */
  private normalizeWebhookPayload(body: Record<string, unknown>) {
    const raw = (body.data as Record<string, unknown> | undefined) ?? body;

    const content = [
      raw.content,
      raw.transaction_content,
      raw.description,
      raw.transfer_content,
    ]
      .filter(Boolean)
      .map(String)
      .join(' ');

    const codeFromField = (raw.code as string | undefined)?.trim();
    const code = (
      codeFromField || this.extractPaymentCode(content)
    )?.toUpperCase();

    const transferAmount = Number(
      raw.transferAmount ??
        raw.amount_in ??
        raw.transfer_amount ??
        raw.amount ??
        0,
    );

    const transferType = String(
      raw.transferType ?? raw.transfer_type ?? 'in',
    ).toLowerCase();

    const id =
      raw.id ?? raw.referenceCode ?? raw.reference_number;

    return { code, content, transferAmount, transferType, id };
  }

  private async findOrderByPaymentCode(code: string) {
    const normalized = code.toUpperCase();
    return this.paymentOrderModel
      .findOne({
        paymentCode: { $regex: new RegExp(`^${normalized}$`, 'i') },
      })
      .exec();
  }

  private extractPaymentCode(content?: string): string | undefined {
    if (!content) return undefined;
    const prefix = this.sepayService.paymentPrefix;
    const regex = new RegExp(`${prefix}\\d{6,10}`, 'i');
    const match = content.match(regex);
    return match?.[0]?.toUpperCase();
  }

  async simulatePayment(invoiceNumber: string, userId: string) {
    const allowSimulate =
      this.config.get<string>('SEPAY_SIMULATE') === 'true' ||
      this.sepayService.isSimulateMode;

    if (!allowSimulate) {
      throw new BadRequestException(
        'Mô phỏng thanh toán chỉ khả dụng ở chế độ test',
      );
    }

    const order = await this.paymentOrderModel
      .findOne({ invoiceNumber, owner: new Types.ObjectId(userId) })
      .exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn thanh toán');
    }

    await this.completePayment(invoiceNumber, `SIM-${Date.now()}`);
    return this.getOrderStatus(invoiceNumber, userId);
  }

  async completePayment(invoiceNumber: string, sepayOrderId?: string) {
    const order = await this.paymentOrderModel
      .findOne({ invoiceNumber })
      .exec();

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn thanh toán');
    }

    if (order.status === PaymentOrderStatus.SUCCESS) {
      return order;
    }

    const userId = order.owner.toString();

    if (order.purpose === PaymentPurpose.TOPUP) {
      await this.transactionsService.completePending(
        order.transactionId!.toString(),
      );
      await this.usersService.adjustBalance(userId, order.totalAmount);
    } else if (order.purpose === PaymentPurpose.LISTING) {
      if (order.balanceUsed > 0) {
        const user = await this.usersService.findOne(userId);
        if ((user.balance ?? 0) < order.balanceUsed) {
          throw new BadRequestException(
            'Số dư không đủ để hoàn tất đăng tin',
          );
        }
        await this.usersService.adjustBalance(userId, -order.balanceUsed);
      }

      const listing = await this.listingsService.create(
        {
          ...(order.listingDraft as unknown as CreateListingDto),
          owner: userId,
        },
        { paid: true },
      );

      order.listingId = new Types.ObjectId(String(listing._id));
      await this.transactionsService.completePending(
        order.transactionId!.toString(),
      );
    }

    order.status = PaymentOrderStatus.SUCCESS;
    if (sepayOrderId) {
      order.sepayOrderId = sepayOrderId;
    }
    await order.save();

    return order;
  }

  async failPayment(invoiceNumber: string) {
    const order = await this.paymentOrderModel
      .findOne({ invoiceNumber })
      .exec();

    if (!order || order.status !== PaymentOrderStatus.PENDING) {
      return null;
    }

    order.status = PaymentOrderStatus.FAILED;
    await order.save();

    if (order.transactionId) {
      await this.transactionsService.failPending(order.transactionId.toString());
    }

    return order;
  }

  async markCancelled(invoiceNumber: string, userId: string) {
    const order = await this.paymentOrderModel
      .findOne({ invoiceNumber, owner: new Types.ObjectId(userId) })
      .exec();

    if (!order || order.status !== PaymentOrderStatus.PENDING) {
      return null;
    }

    order.status = PaymentOrderStatus.CANCELLED;
    await order.save();

    if (order.transactionId) {
      await this.transactionsService.failPending(
        order.transactionId.toString(),
        'Đã hủy thanh toán',
      );
    }

    return order;
  }
}
