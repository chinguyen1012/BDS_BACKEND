const PACKAGE_PRICES: Record<string, number> = {
  standard: 0,
  vip: 2000,
  diamond: 30000,
};

/** Tính phí đăng tin theo gói và số ngày (đồng bộ với frontend). */
export function calcListingPrice(
  pkg: string = 'standard',
  duration: number | string = 7,
): number {
  const days = Number(duration) || 7;
  const basePrice = PACKAGE_PRICES[pkg] ?? 0;
  const discount = days === 15 ? 15 : days === 10 ? 10 : 0;
  return Math.round(basePrice * days * (1 - discount / 100));
}
