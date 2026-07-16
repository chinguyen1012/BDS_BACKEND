import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import {
  PaymentOrderStatus,
  PaymentPurpose,
} from '../../../common/enums/payment.enums';
import { PaymentMethod } from '../../../common/enums/transaction.enums';
import { WalletType } from '../../../common/enums/organization.enums';

export type PaymentOrderDocument = HydratedDocument<PaymentOrder>;

@Schema({ timestamps: true })
export class PaymentOrder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  invoiceNumber: string;

  /** Mã thanh toán SePay (vd: BDS123456) — dùng trong nội dung CK & webhook. */
  @Prop({ required: true, unique: true, index: true })
  paymentCode: string;

  @Prop({ enum: PaymentPurpose, required: true })
  purpose: PaymentPurpose;

  @Prop({ enum: PaymentOrderStatus, default: PaymentOrderStatus.PENDING })
  status: PaymentOrderStatus;

  /** Số tiền cần thanh toán qua Sepay (phần thiếu). */
  @Prop({ required: true, min: 0 })
  payAmount: number;

  /** Tổng phí (đăng tin / nạp tiền). */
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  /** Số dư sẽ trừ khi thanh toán thành công. */
  @Prop({ default: 0, min: 0 })
  balanceUsed: number;

  @Prop({ enum: PaymentMethod, default: PaymentMethod.QR })
  method: PaymentMethod;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  transactionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  listingId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  listingDraft?: Record<string, unknown>;

  @Prop()
  sepayOrderId?: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ enum: WalletType, default: WalletType.PERSONAL })
  walletType: WalletType;
}

export const PaymentOrderSchema = SchemaFactory.createForClass(PaymentOrder);
