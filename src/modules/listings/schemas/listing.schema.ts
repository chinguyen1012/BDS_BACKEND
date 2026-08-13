import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  ListingPackage,
  ListingPurpose,
  ListingStatus,
} from '../../../common/enums/listing.enums';
import { ListingContext } from '../../../common/enums/organization.enums';

export type ListingDocument = HydratedDocument<Listing>;

@Schema({ _id: false })
export class ApprovalHistoryEntry {
  @Prop({ required: true })
  step: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop({ required: true })
  action: string;

  @Prop()
  note?: string;

  @Prop({ default: () => new Date() })
  at: Date;
}

const ApprovalHistorySchema = SchemaFactory.createForClass(ApprovalHistoryEntry);

@Schema({ _id: false })
export class PendingRenewal {
  @Prop({ required: true })
  duration: number;

  @Prop({ required: true })
  package: string;

  @Prop({ default: 0 })
  postCost: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: Types.ObjectId;

  @Prop({ default: () => new Date() })
  requestedAt: Date;
}

const PendingRenewalSchema = SchemaFactory.createForClass(PendingRenewal);

@Schema({ timestamps: true })
export class Listing {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  postedBy?: Types.ObjectId;

  @Prop({ enum: ListingContext, default: ListingContext.PERSONAL, index: true })
  context: ListingContext;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ type: [ApprovalHistorySchema], default: [] })
  approvalHistory: ApprovalHistoryEntry[];

  @Prop({ required: true, trim: true })
  title: string;

  /**
   * Mã tin công khai (vd: BDS-A3K9M2) — dùng search / URL thay ObjectId.
   */
  @Prop({ trim: true, unique: true, sparse: true, uppercase: true, index: true })
  publicCode?: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ enum: ListingPurpose, default: ListingPurpose.SALE })
  purpose: ListingPurpose;

  // Địa chỉ
  @Prop({ trim: true })
  province: string;

  @Prop({ trim: true })
  district?: string;

  @Prop({ trim: true })
  ward: string;

  @Prop({ trim: true })
  street: string;

  @Prop({ trim: true })
  detail: string;

  @Prop({ trim: true })
  project: string;

  /** Liên kết dự án (nếu chọn từ danh mục) */
  @Prop({ type: Types.ObjectId, ref: 'Project', index: true })
  projectId?: Types.ObjectId;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  /** Số tờ bản đồ địa chính */
  @Prop({ trim: true })
  sheetNumber?: string;

  /** Số thửa đất */
  @Prop({ trim: true })
  plotNumber?: string;

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

  /** Chi phí đăng tin đã thanh toán (0 = miễn phí) */
  @Prop()
  postCost?: number;

  /** Đã hoàn về ví khi Admin từ chối (tránh hoàn 2 lần) */
  @Prop({ default: 0 })
  refundedAmount: number;

  /** Staff gửi yêu cầu gia hạn — chờ Owner/Manager duyệt. */
  @Prop({ type: PendingRenewalSchema })
  pendingRenewal?: PendingRenewal;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
