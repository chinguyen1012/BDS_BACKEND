import { ListingStatus } from '../enums/listing.enums';

/** Tin đã xuất bản — dùng cho báo cáo, phân tích, thống kê thành viên */
export const PUBLISHED_LISTING_STATUSES: ListingStatus[] = [
  ListingStatus.PUBLISHED,
  ListingStatus.ACTIVE,
];

/** Tin đang giữ hạn mức ngân sách (chờ duyệt hoặc đã đăng), không gồm tin bị từ chối */
export const BUDGET_RESERVED_LISTING_STATUSES: ListingStatus[] = [
  ListingStatus.PENDING_MANAGER,
  ListingStatus.PENDING_ADMIN,
  ListingStatus.PUBLISHED,
  ListingStatus.ACTIVE,
  ListingStatus.PENDING,
];
