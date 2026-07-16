export enum PaymentPurpose {
  TOPUP = 'topup',
  LISTING = 'listing',
  LISTING_RENEWAL = 'listing_renewal',
  ORG_TOPUP = 'org_topup',
  ORG_LISTING = 'org_listing',
}

export enum PaymentOrderStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
