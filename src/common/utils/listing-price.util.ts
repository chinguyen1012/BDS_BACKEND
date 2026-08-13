import {
  DEFAULT_PRICING_CONFIG,
  mergePricingConfig,
  normalizeAccountTypeKey,
  normalizePackageKey,
  type PricingConfig,
} from '../../modules/pricing/pricing.constants';

/**
 * Fallback sync khi chưa inject PricingService (legacy).
 * Nguồn đúng: PricingService + admin config trong DB.
 */
let cached: PricingConfig = structuredClone(DEFAULT_PRICING_CONFIG);

export function setListingPriceUtilConfig(config: PricingConfig) {
  cached = mergePricingConfig(config);
}

export function calcListingPrice(
  pkg: string = 'standard',
  duration: number | string = 5,
  accountType?: string | null,
): number {
  const packageKey = normalizePackageKey(pkg);
  const account = normalizeAccountTypeKey(accountType);
  const days = Number(duration) || cached.packages[packageKey].durations[0]?.days || 5;
  const option = cached.packages[packageKey].durations.find((d) => d.days === days);
  if (!option) {
    const fallback = cached.packages[packageKey].durations[0];
    if (!fallback) return 0;
    return applyMembership(fallback.price, account, cached);
  }
  return applyMembership(option.price, account, cached);
}

function applyMembership(
  listPrice: number,
  account: ReturnType<typeof normalizeAccountTypeKey>,
  config: PricingConfig,
) {
  const price = Math.max(0, Math.round(listPrice));
  if (price <= 0) return 0;
  const pct = config.membership[account].listingDiscountPercent;
  return Math.round(price * (1 - pct / 100));
}
