export enum AuctionBidStatus {
  ACTIVE = 'active',
  OUTBID = 'outbid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export type AuctionFloorRange = {
  from: number;
  to: number;
  dailyFloor: number;
};

export const DEFAULT_AUCTION_FLOORS: AuctionFloorRange[] = [
  { from: 1, to: 10, dailyFloor: 35000 },
  { from: 11, to: 20, dailyFloor: 25000 },
  { from: 21, to: 30, dailyFloor: 20000 },
  { from: 31, to: 40, dailyFloor: 10000 },
  { from: 41, to: 50, dailyFloor: 10000 },
];

export const DEFAULT_MAX_AUCTION_SLOTS = 50;
export const MINUTES_PER_DAY = 24 * 60;

/** Hủy sớm: tối thiểu giữ 50% giá sàn vị trí. Phần đã dùng được trừ vào. */
export const CANCEL_FLOOR_PENALTY_RATIO = 0.5;
