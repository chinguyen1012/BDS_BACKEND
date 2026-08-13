export enum NotificationCategory {
  LISTING = 'listing',
  FINANCE = 'finance',
  PROMO = 'promo',
  ACCOUNT = 'account',
  OTHER = 'other',
}

const LISTING_TYPES = new Set([
  'listing',
  'listing_approved',
  'listing_rejected',
  'listing_expired',
  'listing_contact',
  'auction',
]);

const FINANCE_TYPES = new Set([
  'finance',
  'payment',
  'topup',
  'wallet_topup',
  'wallet_spend',
  'wallet_refund',
  'refund',
  'transaction',
  'wallet',
]);

const PROMO_TYPES = new Set([
  'promo',
  'promotion',
  'membership',
  'voucher',
]);

const ACCOUNT_TYPES = new Set([
  'account',
  'org_invitation',
  'org_invitation_accepted',
  'security',
]);

export function resolveNotificationCategory(
  type: string,
): NotificationCategory {
  const key = String(type || '')
    .trim()
    .toLowerCase();
  if (!key) return NotificationCategory.OTHER;
  if (LISTING_TYPES.has(key) || key.startsWith('listing')) {
    return NotificationCategory.LISTING;
  }
  if (
    FINANCE_TYPES.has(key) ||
    key.startsWith('payment') ||
    key.startsWith('topup') ||
    key.startsWith('wallet')
  ) {
    return NotificationCategory.FINANCE;
  }
  if (
    PROMO_TYPES.has(key) ||
    key.startsWith('promo') ||
    key.startsWith('membership')
  ) {
    return NotificationCategory.PROMO;
  }
  if (
    ACCOUNT_TYPES.has(key) ||
    key.startsWith('org_') ||
    key.startsWith('account')
  ) {
    return NotificationCategory.ACCOUNT;
  }
  return NotificationCategory.OTHER;
}
