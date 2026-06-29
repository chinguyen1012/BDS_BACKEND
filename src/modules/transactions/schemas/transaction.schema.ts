import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../../common/enums/transaction.enums';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ required: true, trim: true })
  description: string;

  /** Dương = cộng tiền (nạp/hoàn), âm = trừ tiền (thanh toán). */
  @Prop({ required: true })
  amount: number;

  @Prop({ enum: PaymentMethod, default: PaymentMethod.BALANCE })
  method: PaymentMethod;

  @Prop({ enum: TransactionStatus, default: TransactionStatus.SUCCESS })
  status: TransactionStatus;

  @Prop({ index: true })
  invoiceNumber?: string;

  @Prop({ type: Types.ObjectId, ref: 'PaymentOrder' })
  paymentOrderId?: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
