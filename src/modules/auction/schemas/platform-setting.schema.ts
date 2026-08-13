import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import {
  AuctionFloorRange,
  DEFAULT_AUCTION_FLOORS,
  DEFAULT_MAX_AUCTION_SLOTS,
} from '../../../common/enums/auction.enums';

export type PlatformSettingDocument = HydratedDocument<PlatformSetting>;

@Schema({ _id: false })
export class AuctionFloor {
  @Prop({ required: true, min: 1 })
  from: number;

  @Prop({ required: true, min: 1 })
  to: number;

  @Prop({ required: true, min: 0 })
  dailyFloor: number;
}

const AuctionFloorSchema = SchemaFactory.createForClass(AuctionFloor);

@Schema({ _id: false })
export class ListingAuctionSettings {
  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: DEFAULT_MAX_AUCTION_SLOTS, min: 1, max: 200 })
  maxAuctionSlots: number;

  @Prop({ type: [AuctionFloorSchema], default: () => DEFAULT_AUCTION_FLOORS })
  floors: AuctionFloorRange[];
}

const ListingAuctionSettingsSchema = SchemaFactory.createForClass(
  ListingAuctionSettings,
);

@Schema({ _id: false })
export class PaginationSettings {
  /** Số bản ghi mỗi trang trên dashboard / danh sách */
  @Prop({ default: 20, min: 1, max: 100 })
  pageSize: number;
}

const PaginationSettingsSchema = SchemaFactory.createForClass(PaginationSettings);

@Schema({ timestamps: true, collection: 'platform_settings' })
export class PlatformSetting {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ type: ListingAuctionSettingsSchema })
  listingAuction?: ListingAuctionSettings;

  @Prop({ type: PaginationSettingsSchema })
  pagination?: PaginationSettings;

  /** Cấu hình giá gói tin + % membership (key = 'pricing'). */
  @Prop({ type: Object })
  packages?: Record<string, unknown>;

  @Prop({ type: Object })
  membership?: Record<string, unknown>;

  @Prop({ type: Object })
  showcases?: Record<string, unknown>;

  @Prop({ type: Array })
  compareRows?: unknown[];

  @Prop({ type: Array })
  faqs?: unknown[];
}

export const PlatformSettingSchema =
  SchemaFactory.createForClass(PlatformSetting);
