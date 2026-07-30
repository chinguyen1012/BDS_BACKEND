import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { AuctionBidStatus } from '../../../common/enums/auction.enums';

export type ListingAuctionBidDocument = HydratedDocument<ListingAuctionBid>;

@Schema({ timestamps: true, collection: 'listing_auction_bids' })
export class ListingAuctionBid {
  @Prop({ type: Types.ObjectId, ref: 'Listing', required: true, index: true })
  listingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', index: true })
  organizationId?: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  dailyBidAmount: number;

  @Prop({ required: true, min: 1, max: 90 })
  durationDays: number;

  /** Phần ký quỹ còn lại (chưa trừ / chưa hoàn). */
  @Prop({ required: true, min: 0 })
  heldAmount: number;

  /** Tổng đã trừ theo phút hiển thị. */
  @Prop({ default: 0, min: 0 })
  chargedAmount: number;

  @Prop({ default: 0, min: 0 })
  refundedAmount: number;

  @Prop({ type: Date, default: null })
  rankedSinceAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastSettledAt?: Date | null;

  @Prop({ type: Date, required: true })
  startsAt: Date;

  @Prop({ type: Date, required: true, index: true })
  endsAt: Date;

  @Prop({
    enum: AuctionBidStatus,
    default: AuctionBidStatus.ACTIVE,
    index: true,
  })
  status: AuctionBidStatus;

  /** Rank hiện tại 1..maxSlots, null nếu ngoài top. */
  @Prop({ type: Number, default: null })
  currentRank?: number | null;
}

export const ListingAuctionBidSchema =
  SchemaFactory.createForClass(ListingAuctionBid);

ListingAuctionBidSchema.index({ status: 1, dailyBidAmount: -1 });
ListingAuctionBidSchema.index({ listingId: 1, status: 1 });
ListingAuctionBidSchema.index({ ownerId: 1, status: 1 });
