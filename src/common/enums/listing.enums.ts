export enum ListingStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  EXPIRED = 'expired',
  DRAFT = 'draft',
  REJECTED = 'rejected',
  /** Organization workflow */
  PENDING_MANAGER = 'pending_manager',
  REJECTED_BY_MANAGER = 'rejected_by_manager',
  PENDING_ADMIN = 'pending_admin',
  REJECTED_BY_ADMIN = 'rejected_by_admin',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ListingPackage {
  STANDARD = 'standard',
  VIP = 'vip',
  DIAMOND = 'diamond',
}

export enum ListingPurpose {
  SALE = 'sale',
  RENT = 'rent',
}
