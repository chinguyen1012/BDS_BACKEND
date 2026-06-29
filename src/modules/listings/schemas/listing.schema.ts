import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  ListingPackage,
  ListingPurpose,
  ListingStatus,
} from '../../../common/enums/listing.enums';

export type ListingDocument = HydratedDocument<Listing>;

@Schema({ timestamps: true })
export class Listing {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ enum: ListingPurpose, default: ListingPurpose.SALE })
  purpose: ListingPurpose;

  // Địa chỉ
  @Prop({ trim: true })
  province: string;

  @Prop({ trim: true })
  ward: string;

  @Prop({ trim: true })
  street: string;

  @Prop({ trim: true })
  detail: string;

  @Prop({ trim: true })
  project: string;

  // Thông tin BĐS
  @Prop({ trim: true })
  propertyType: string;

  @Prop({ default: 0 })
  area: number;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: 'VND' })
  priceCurrency: string;

  @Prop({ default: 0 })
  bedrooms: number;

  @Prop({ default: 0 })
  bathrooms: number;

  @Prop({ default: 0 })
  floors: number;

  @Prop()
  direction: string;

  @Prop()
  legalStatus: string;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  // Media
  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  video: string;

  // Gói đăng & trạng thái
  @Prop({ enum: ListingPackage, default: ListingPackage.STANDARD })
  package: ListingPackage;

  @Prop({ enum: ListingStatus, default: ListingStatus.PENDING, index: true })
  status: ListingStatus;

  @Prop({ default: 7 })
  duration: number;

  @Prop()
  startDate: Date;

  @Prop()
  expiresAt: Date;

  // Thống kê
  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  contacts: number;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
