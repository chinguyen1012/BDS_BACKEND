import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { CustomerStatus } from '../../../common/enums/customer.enums';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  interest: string;

  @Prop({ enum: CustomerStatus, default: CustomerStatus.NEW })
  status: CustomerStatus;

  @Prop()
  lastContact: Date;

  @Prop({ type: Types.ObjectId, ref: 'Listing' })
  listing: Types.ObjectId;

  @Prop({ trim: true })
  note: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
