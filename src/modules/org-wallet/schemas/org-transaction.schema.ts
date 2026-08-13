import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { OrgTransactionType } from '../../../common/enums/organization.enums';
import { TransactionStatus } from '../../../common/enums/transaction.enums';

export type OrgTransactionDocument = HydratedDocument<OrgTransaction>;

@Schema({ timestamps: true })
export class OrgTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ enum: OrgTransactionType, required: true })
  type: OrgTransactionType;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, min: 0 })
  balanceAfter: number;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  listingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PaymentOrder' })
  paymentOrderId?: Types.ObjectId;

  @Prop({ index: true })
  invoiceNumber?: string;

  @Prop({ enum: TransactionStatus, default: TransactionStatus.SUCCESS })
  status: TransactionStatus;
}

export const OrgTransactionSchema = SchemaFactory.createForClass(OrgTransaction);

OrgTransactionSchema.index({ organizationId: 1, createdAt: -1 });
