import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
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
import { CreateListingRenewalPaymentDto } from './dto/create-listing-renewal-payment.dto';
import { CreateListingDto } from '../listings/dto/create-listing.dto';
import { calcListingPrice } from '../../common/utils/listing-price.util';
import { ListingStatus } from '../../common/enums/listing.enums';
import { OrgWalletService } from '../org-wallet/org-wallet.service';
import { BudgetPoliciesService } from '../budget-policies/budget-policies.service';
import { OrgMembershipsService } from '../org-memberships/org-memberships.service';
import { ListingContext, OrgTransactionType, WalletType } from '../../common/enums/organization.enums';
import { ListingDocument } from '../listings/schemas/listing.schema';

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
    @Inject(forwardRef(() => OrgWalletService))
    private readonly orgWalletService: OrgWalletService,
    private readonly budgetPoliciesService: BudgetPoliciesService,
    private readonly orgMembershipsService: OrgMembershipsService,
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
    if (
      dto.context === ListingContext.ORGANIZATION &&
      dto.organizationId
    ) {
      return this.submitOrgListing(userId, dto);
    }

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

  async createListingRenewalPayment(
    userId: string,
    dto: CreateListingRenewalPaymentDto,
  ) {
    const listing = await this.listingsService.findOne(dto.listingId);
    const orgId = this.resolveOrgId(listing);

    if (orgId) {
      await this.orgMembershipsService.assertOwnerOrManager(orgId, userId);
    } else if (listing.owner.toString() !== userId) {
      throw new BadRequestException('Bạn không có quyền gia hạn tin này');
    }

    const renewable = [
      ListingStatus.ACTIVE,
      ListingStatus.PUBLISHED,
      ListingStatus.EXPIRED,
    ];
    if (!renewable.includes(listing.status)) {
      throw new BadRequestException(
        'Chỉ gia hạn được tin đang hiển thị hoặc đã hết hạn. Tin chờ duyệt / bị từ chối không thể gia hạn.',
      );
    }

    const pkg = dto.package || listing.package || 'standard';
    const duration = dto.duration || 7;
    const totalAmount = calcListingPrice(pkg, duration);

    if (orgId) {
      return this.createOrgListingRenewalPayment(
        userId,
        orgId,
        listing,
        dto.listingId,
        pkg,
        duration,
        totalAmount,
      );
    }

    const user = await this.usersService.findOne(userId);
    const balance = user.balance ?? 0;
    const balanceUsed = Math.min(balance, totalAmount);
    const payAmount = Math.max(0, totalAmount - balanceUsed);

    if (payAmount === 0) {
      return this.completeRenewalWithBalance(
        userId,
        dto.listingId,
        duration,
        totalAmount,
        balanceUsed,
        listing.title,
      );
    }

    const invoiceNumber = this.sepayService.createInvoice('RENEW');
    const paymentCode = this.sepayService.createPaymentCode();
    const description = `Gia hạn tin ${duration} ngày - ${listing.title}`;

    const transaction = await this.transactionsService.createPending({
      owner: userId,
      type: TransactionType.SPEND,
      description,
      amount: -totalAmount,
      method: PaymentMethod.QR,
      invoiceNumber,
    });

    const order = await this.paymentOrderModel.create({
      owner: new Types.ObjectId(userId),
      invoiceNumber,
      paymentCode,
      purpose: PaymentPurpose.LISTING_RENEWAL,
      status: PaymentOrderStatus.PENDING,
      payAmount,
      totalAmount,
      balanceUsed,
      method: PaymentMethod.QR,
      transactionId: transaction._id,
      listingId: new Types.ObjectId(dto.listingId),
      listingDraft: {
        duration,
        package: pkg,
        listingId: dto.listingId,
      },
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

  private resolveOrgId(listing: ListingDocument): string | null {
    if (listing.context !== ListingContext.ORGANIZATION) return null;
    return listing.organizationId?.toString() ?? null;
  }

  private async createOrgListingRenewalPayment(
    userId: string,
    organizationId: string,
    listing: ListingDocument,
    listingId: string,
    pkg: string,
    duration: number,
    totalAmount: number,
  ) {
    const wallet = await this.orgWalletService.getBalance(organizationId);
    const balance = wallet.balance ?? 0;
    const balanceUsed = Math.min(balance, totalAmount);
    const payAmount = Math.max(0, totalAmount - balanceUsed);

    if (payAmount === 0) {
      return this.completeOrgRenewalWithBalance(
        userId,
        organizationId,
        listingId,
        duration,
        totalAmount,
        balanceUsed,
        listing.title,
      );
    }

    const invoiceNumber = this.sepayService.createInvoice('ORENEW');
    const paymentCode = this.sepayService.createPaymentCode();
    const description = `Gia hạn tin org ${duration} ngày - ${listing.title}`;

    const order = await this.paymentOrderModel.create({
      owner: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
      walletType: WalletType.ORGANIZATION,
      invoiceNumber,
      paymentCode,
      purpose: PaymentPurpose.LISTING_RENEWAL,
      status: PaymentOrderStatus.PENDING,
      payAmount,
      totalAmount,
      balanceUsed,
      method: PaymentMethod.QR,
      listingId: new Types.ObjectId(listingId),
      listingDraft: {
        duration,
        package: pkg,
        listingId,
      },
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
      organizationId,
    };
  }

  private async completeRenewalWithBalance(
    userId: string,
    listingId: string,
    duration: number,
    totalAmount: number,
    balanceUsed: number,
    title: string,
  ) {
    if (balanceUsed > 0) {
      await this.transactionsService.spend(
        userId,
        balanceUsed,
        `Gia hạn tin: ${title}`,
      );
    }

    const listing = await this.listingsService.renew(listingId, {
      days: duration,
      userId,
      paid: true,
    });

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

  private async completeOrgRenewalWithBalance(
    userId: string,
    organizationId: string,
    listingId: string,
    duration: number,
    totalAmount: number,
    balanceUsed: number,
    title: string,
  ) {
    if (balanceUsed > 0) {
      await this.orgWalletService.adjustBalance(organizationId, -balanceUsed, {
        type: OrgTransactionType.SPEND,
        description: `Gia hạn tin: ${title}`,
        performedBy: userId,
        listingId,
      });
    }

    const listing = await this.listingsService.renew(listingId, {
      days: duration,
      userId,
      paid: true,
    });

    const wallet = await this.orgWalletService.getBalance(organizationId);

    return {
      mode: 'balance' as const,
      listing,
      totalAmount,
      balanceUsed,
      payAmount: 0,
      balance: wallet.balance,
      organizationId,
    };
  }

  private async submitOrgListing(
    userId: string,
    dto: CreateListingPaymentDto,
  ) {
    const orgId = dto.organizationId!;
    const totalAmount = calcListingPrice(dto.package, dto.duration ?? 7);

    await this.budgetPoliciesService.assertCanPost(
      orgId,
      userId,
      totalAmount,
      dto.package ?? 'standard',
    );

    const listing = await this.listingsService.createOrgPending(
      userId,
      orgId,
      dto,
    );

    return {
      mode: 'org_pending' as const,
      listing,
      totalAmount,
      status: listing.status,
      organizationId: orgId,
    };
  }

  async createOrgTopupPayment(
    userId: string,
    organizationId: string,
    dto: CreateTopupPaymentDto,
  ) {
    const invoiceNumber = this.sepayService.createInvoice('ORGTOP');
    const paymentCode = this.sepayService.createPaymentCode();
    const description = `Nạp ví Organization ${dto.amount.toLocaleString('vi-VN')}đ`;

    const order = await this.paymentOrderModel.create({
      owner: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
      walletType: WalletType.ORGANIZATION,
      invoiceNumber,
      paymentCode,
      purpose: PaymentPurpose.ORG_TOPUP,
      status: PaymentOrderStatus.PENDING,
      payAmount: dto.amount,
      totalAmount: dto.amount,
      balanceUsed: 0,
      method: dto.method,
      description,
    });

    const checkout = this.buildCheckout(
      invoiceNumber,
      paymentCode,
      dto.amount,
      description,
      userId,
    );

    const balance = await this.orgWalletService.getBalance(organizationId);

    return {
      mode: 'sepay' as const,
      invoiceNumber,
      paymentCode,
      orderId: order._id,
      payAmount: dto.amount,
      totalAmount: dto.amount,
      balance: balance.balance,
      balanceUsed: 0,
      checkout,
      organizationId,
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
      { paid: true, postCost: totalAmount },
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
    } else if (order.purpose === PaymentPurpose.ORG_TOPUP) {
      if (!order.organizationId) {
        throw new BadRequestException('Thiếu organizationId cho nạp ví org');
      }
      await this.orgWalletService.adjustBalance(
        order.organizationId.toString(),
        order.totalAmount,
        {
          type: OrgTransactionType.TOPUP,
          description: order.description ?? 'Nạp ví Organization',
          performedBy: userId,
          paymentOrderId: order._id.toString(),
          invoiceNumber: order.invoiceNumber,
        },
      );
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
        { paid: true, postCost: order.totalAmount },
      );

      order.listingId = new Types.ObjectId(String(listing._id));
      await this.transactionsService.completePending(
        order.transactionId!.toString(),
      );
    } else if (order.purpose === PaymentPurpose.LISTING_RENEWAL) {
      const draft = (order.listingDraft ?? {}) as {
        duration?: number;
        listingId?: string;
      };
      const listingId =
        order.listingId?.toString() || draft.listingId || '';
      const duration = Number(draft.duration) || 7;

      if (!listingId) {
        throw new BadRequestException('Thiếu listingId cho gia hạn tin');
      }

      if (order.organizationId) {
        if (order.balanceUsed > 0) {
          await this.orgWalletService.adjustBalance(
            order.organizationId.toString(),
            -order.balanceUsed,
            {
              type: OrgTransactionType.SPEND,
              description: order.description ?? 'Gia hạn tin Organization',
              performedBy: userId,
              listingId,
              paymentOrderId: order._id.toString(),
              invoiceNumber: order.invoiceNumber,
            },
          );
        }
      } else if (order.balanceUsed > 0) {
        const user = await this.usersService.findOne(userId);
        if ((user.balance ?? 0) < order.balanceUsed) {
          throw new BadRequestException(
            'Số dư không đủ để hoàn tất gia hạn tin',
          );
        }
        await this.usersService.adjustBalance(userId, -order.balanceUsed);
      }

      await this.listingsService.renew(listingId, {
        days: duration,
        userId,
        paid: true,
      });

      if (order.transactionId) {
        await this.transactionsService.completePending(
          order.transactionId.toString(),
        );
      }
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
