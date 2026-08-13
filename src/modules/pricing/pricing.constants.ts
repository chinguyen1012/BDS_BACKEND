/**
 * Default pricing — admin có thể ghi đè qua PlatformSetting key `pricing`.
 */

export type AccountTypeKey = 'individual' | 'pro' | 'business';
export type ListingPackageKey = 'standard' | 'vip' | 'diamond';

export type DurationOptionConfig = {
  /** Số ngày đăng / gia hạn. */
  days: number;
  /** Giá cố định (VND) cho gói + số ngày này. 0 = miễn phí. */
  price: number;
  /** Nhãn hiển thị tuỳ chọn (vd: Miễn phí, Tiết kiệm). */
  label?: string;
};

export type MembershipPricingPolicy = {
  /** % giảm trên giá gói tin (khi price > 0). */
  listingDiscountPercent: number;
  /** % giảm ký quỹ đấu giá. */
  auctionFeeDiscountPercent: number;
};

/** Nội dung card gói hội viên — admin chỉnh, placeholder % tự thay khi hiển thị. */
export type PlanShowcaseConfig = {
  name: string;
  tagline: string;
  bestFor: string;
  priceLabel: string;
  monthly?: number;
  yearly?: number;
  highlights: string[];
  features: string[];
  notIncluded?: string[];
  ctaHint: string;
};

/** Một dòng bảng so sánh — ô có thể ✓/✗ (boolean) hoặc text (+ placeholder %). */
export type CompareRowConfig = {
  feature: string;
  group?: string;
  individual: string | boolean;
  pro: string | boolean;
  business: string | boolean;
};

/** Câu hỏi thường gặp trang hội viên — placeholder % trong câu trả lời. */
export type FaqItemConfig = {
  q: string;
  a: string;
};

export type PricingConfig = {
  packages: Record<
    ListingPackageKey,
    {
      durations: DurationOptionConfig[];
    }
  >;
  membership: Record<AccountTypeKey, MembershipPricingPolicy>;
  showcases: Record<AccountTypeKey, PlanShowcaseConfig>;
  compareRows: CompareRowConfig[];
  faqs: FaqItemConfig[];
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  packages: {
    standard: {
      durations: [
        { days: 5, price: 0, label: 'Miễn phí' },
        { days: 15, price: 15000, label: 'Trả phí' },
        { days: 30, price: 25000, label: 'Trả phí' },
      ],
    },
    vip: {
      durations: [
        { days: 15, price: 30000 },
        { days: 30, price: 54000, label: 'Tiết kiệm' },
        { days: 45, price: 76500, label: 'Tiết kiệm' },
      ],
    },
    diamond: {
      durations: [
        { days: 30, price: 900000 },
        { days: 45, price: 1_215_000, label: 'Tiết kiệm' },
        { days: 60, price: 1_530_000, label: 'Tiết kiệm' },
      ],
    },
  },
  membership: {
    individual: {
      listingDiscountPercent: 0,
      auctionFeeDiscountPercent: 0,
    },
    pro: {
      listingDiscountPercent: 10,
      auctionFeeDiscountPercent: 10,
    },
    business: {
      listingDiscountPercent: 15,
      auctionFeeDiscountPercent: 15,
    },
  },
  showcases: {
    individual: {
      name: 'Tài khoản thường',
      tagline: 'Miễn phí — tin thường 0đ; VIP/KC & đấu giá theo giá niêm yết',
      bestFor: 'Chủ nhà, người đăng ít tin, mới làm quen nền tảng',
      priceLabel: 'Miễn phí',
      highlights: ['Tin thường miễn phí', 'Giá niêm yết VIP/KC', 'Đấu giá đủ phí'],
      features: [
        'Đăng tin thường miễn phí',
        'Mua VIP / Kim cương theo giá gói + số ngày',
        'Gia hạn tin theo giá niêm yết',
        'Tham gia đấu giá đẩy tin (không ưu đãi)',
        'Nạp ví cá nhân để thanh toán',
      ],
      notIncluded: [
        'Không giảm giá VIP/KC',
        'Không giảm ký quỹ đấu giá',
        'Không có Organization',
      ],
      ctaHint: 'Membership không biến tin thường thành VIP',
    },
    pro: {
      name: 'Tài khoản Pro',
      tagline: 'Giảm giá gói tin nổi & đấu giá — vẫn chọn Thường / VIP / KC',
      bestFor: 'Môi giới cá nhân đăng nhiều tin',
      priceLabel: 'Có phí tháng / năm',
      monthly: 299000,
      yearly: 2189000,
      highlights: [
        '-{proListingDiscount}% VIP/KC',
        '-{proAuctionDiscount}% ký quỹ đấu giá',
        'Huy hiệu Pro',
      ],
      features: [
        'Tin thường vẫn miễn phí',
        'Giảm {proListingDiscount}% khi đăng / gia hạn VIP & Kim cương',
        'Giảm {proAuctionDiscount}% ký quỹ đấu giá (giá đấu xếp hạng không đổi)',
        'Huy hiệu Pro trên tin & hồ sơ',
        'Báo cáo hiệu suất nâng cao',
        'Hỗ trợ ưu tiên',
      ],
      notIncluded: [
        'Không tự đổi gói tin',
        'Không tự thắng đấu giá',
        'Không có Organization',
      ],
      ctaHint: 'Pro + tin thường = vẫn là tin thường',
    },
    business: {
      name: 'Tài khoản Doanh nghiệp',
      tagline:
        'Organization + giảm {businessListingDiscount}% tin Org; đăng tin cá nhân hưởng quyền Pro',
      bestFor: 'Sàn / đội nhóm từ 2 người',
      priceLabel: 'Có phí tháng / năm',
      monthly: 990000,
      yearly: 8990000,
      highlights: [
        'Organization',
        '-{businessListingDiscount}% tin Org',
        'Tin cá nhân = Pro',
      ],
      features: [
        'Đăng tin cá nhân: ưu đãi như Pro (−{proListingDiscount}%)',
        'Đăng / đấu giá tin Organization: giảm {businessListingDiscount}% gói tin & {businessAuctionDiscount}% ký quỹ (ví Org)',
        '1 Organization workspace',
        'Thành viên, phân quyền, duyệt tin nội bộ',
        'Ví Organization dùng chung',
        'Báo cáo theo nhân viên / chi tiêu',
      ],
      ctaHint: '% Doanh nghiệp chỉ áp dụng khi đăng tin Organization',
    },
  },
  compareRows: [
    {
      group: 'Gói tin (Membership không đổi loại gói)',
      feature: 'Đăng tin thường',
      individual: 'Miễn phí',
      pro: 'Miễn phí',
      business: 'Miễn phí',
    },
    {
      feature: 'VIP / Kim cương',
      individual: 'Giá niêm yết',
      pro: 'Giảm {proListingDiscount}%',
      business:
        'Giảm {businessListingDiscount}% (tin Org); cá nhân = Pro',
    },
    {
      feature: 'Gia hạn tin',
      individual: 'Giá niêm yết',
      pro: 'Giảm {proListingDiscount}% (VIP/KC)',
      business:
        'Giảm {businessListingDiscount}% (tin Org); cá nhân = Pro',
    },
    {
      group: 'Đấu giá đẩy tin (hệ thống riêng)',
      feature: 'Tham gia đấu giá',
      individual: true,
      pro: true,
      business: true,
    },
    {
      feature: 'Giảm ký quỹ đấu giá',
      individual: '{individualAuctionDiscount}%',
      pro: '{proAuctionDiscount}%',
      business: '{businessAuctionDiscount}% tin Org; cá nhân = Pro',
    },
    {
      feature: 'Tự động thắng / đổi VIP→KC',
      individual: false,
      pro: false,
      business: false,
    },
    {
      group: 'Tài khoản & tổ chức',
      feature: 'Huy hiệu loại tài khoản',
      individual: 'Thường',
      pro: 'Pro',
      business: 'Doanh nghiệp',
    },
    {
      feature: 'Báo cáo hiệu suất',
      individual: 'Cơ bản',
      pro: 'Nâng cao',
      business: 'Theo tổ chức',
    },
    {
      feature: 'Organization / nhân viên / ví DN',
      individual: false,
      pro: false,
      business: true,
    },
  ],
  faqs: [
    {
      q: 'Membership và gói tin khác nhau thế nào?',
      a: 'Membership (Thường/Pro/DN) là loại tài khoản. Gói tin (Thường/VIP/Kim cương) là cách tin hiển thị. Pro không tự biến tin thường thành VIP.',
    },
    {
      q: 'Pro được giảm gì?',
      a: 'Giảm {proListingDiscount}% phí đăng/gia hạn VIP & Kim cương, và giảm {proAuctionDiscount}% ký quỹ đấu giá. Giá đấu/ngày dùng xếp hạng không bị hạ — không tự thắng đấu.',
    },
    {
      q: 'Đấu giá có phải VIP/Kim cương không?',
      a: 'Không. Đấu giá là cơ chế riêng để cạnh tranh vị trí. Tin VIP + đấu giá vẫn là tin VIP đang tranh hạng.',
    },
    {
      q: 'Gia hạn tin là gì? Còn reup không?',
      a: 'Chỉ còn một khái niệm Gia hạn tin: chọn số ngày + gói tin, tính giá theo Membership, thanh toán, cập nhật hạn. Không còn reup/credit riêng.',
    },
    {
      q: 'Doanh nghiệp khác Pro chỗ nào?',
      a: 'Có toàn bộ Pro, cộng Organization, nhân viên, phân quyền, ví DN. Ưu đãi gói tin {businessListingDiscount}% & đấu giá {businessAuctionDiscount}% khi trả bằng ví Org. Đăng tin cá nhân hưởng như Pro.',
    },
    {
      q: 'Giá lấy từ đâu?',
      a: 'Admin hệ thống cấu hình tại Giá & ưu đãi. Backend Pricing Engine là nguồn duy nhất — % trên trang này cập nhật theo cấu hình đó.',
    },
  ],
};

/** @deprecated — dùng DEFAULT_PRICING_CONFIG.packages */
export const PACKAGE_DAILY_PRICES: Record<ListingPackageKey, number> = {
  standard: 1000,
  vip: 2000,
  diamond: 30000,
};

export const MEMBERSHIP_PRICING = DEFAULT_PRICING_CONFIG.membership;

export function normalizeAccountTypeKey(
  type?: string | null,
): AccountTypeKey {
  if (type === 'pro' || type === 'business') return type;
  return 'individual';
}

/**
 * Ưu đãi giá theo ngữ cảnh thanh toán:
 * - Tin / đấu giá Organization → luôn `business`
 * - Cá nhân: `business` owner → hưởng `pro` (không lấy % DN khi trừ ví cá nhân)
 * - Còn lại: accountType thật của user
 */
export function resolvePricingAccountForContext(
  accountType?: string | null,
  orgContext?: boolean,
): AccountTypeKey {
  if (orgContext) return 'business';
  const key = normalizeAccountTypeKey(accountType);
  if (key === 'business') return 'pro';
  return key;
}

export function normalizePackageKey(
  pkg?: string | null,
): ListingPackageKey {
  if (pkg === 'vip' || pkg === 'diamond') return pkg;
  return 'standard';
}

export function mergePricingConfig(
  partial?: Partial<PricingConfig> | null,
): PricingConfig {
  const base = structuredClone(DEFAULT_PRICING_CONFIG);
  if (!partial) return base;

  if (partial.packages) {
    for (const key of ['standard', 'vip', 'diamond'] as ListingPackageKey[]) {
      const incoming = partial.packages[key];
      if (incoming?.durations?.length) {
        base.packages[key] = {
          durations: incoming.durations.map((d) => ({
            days: Math.max(1, Math.round(Number(d.days) || 1)),
            price: Math.max(0, Math.round(Number(d.price) || 0)),
            label: d.label?.trim() || undefined,
          })),
        };
      }
    }
  }

  if (partial.membership) {
    for (const key of ['individual', 'pro', 'business'] as AccountTypeKey[]) {
      const m = partial.membership[key];
      if (!m) continue;
      base.membership[key] = {
        listingDiscountPercent: clampPercent(m.listingDiscountPercent),
        auctionFeeDiscountPercent: clampPercent(m.auctionFeeDiscountPercent),
      };
    }
  }

  if (partial.showcases) {
    for (const key of ['individual', 'pro', 'business'] as AccountTypeKey[]) {
      const incoming = partial.showcases[key];
      if (!incoming) continue;
      base.showcases[key] = normalizeShowcaseConfig(incoming);
    }
  }

  if (Array.isArray(partial.compareRows)) {
    base.compareRows = partial.compareRows.length
      ? partial.compareRows.map(normalizeCompareRow)
      : base.compareRows;
  }

  if (Array.isArray(partial.faqs)) {
    base.faqs = partial.faqs.length
      ? partial.faqs.map(normalizeFaqItem)
      : base.faqs;
  }

  return base;
}

/** Thay placeholder % trong copy admin (dùng tên gói cụ thể). */
export function applyMembershipVars(
  text: string,
  membership: Record<AccountTypeKey, MembershipPricingPolicy>,
): string {
  const individual = membership.individual;
  const pro = membership.pro;
  const business = membership.business;
  return text
    .replaceAll(
      '{individualListingDiscount}',
      String(individual.listingDiscountPercent),
    )
    .replaceAll(
      '{individualAuctionDiscount}',
      String(individual.auctionFeeDiscountPercent),
    )
    .replaceAll('{proListingDiscount}', String(pro.listingDiscountPercent))
    .replaceAll('{proAuctionDiscount}', String(pro.auctionFeeDiscountPercent))
    .replaceAll(
      '{businessListingDiscount}',
      String(business.listingDiscountPercent),
    )
    .replaceAll(
      '{businessAuctionDiscount}',
      String(business.auctionFeeDiscountPercent),
    );
}

/**
 * Placeholder copy admin (nên dùng tên gói cụ thể):
 * - {individualListingDiscount} / {individualAuctionDiscount}
 * - {proListingDiscount} / {proAuctionDiscount}
 * - {businessListingDiscount} / {businessAuctionDiscount}
 * Legacy (theo card đang render): {listingDiscount}, {auctionDiscount}
 */
export function applyShowcaseVars(
  text: string,
  membership: Record<AccountTypeKey, MembershipPricingPolicy>,
  tier: AccountTypeKey,
): string {
  const t = membership[tier];
  return applyMembershipVars(text, membership)
    .replaceAll('{listingDiscount}', String(t.listingDiscountPercent))
    .replaceAll('{auctionDiscount}', String(t.auctionFeeDiscountPercent));
}

export type ResolvedPlanShowcase = PlanShowcaseConfig & { id: AccountTypeKey };

export type ResolvedCompareRow = {
  feature: string;
  group?: string;
  individual: string | boolean;
  pro: string | boolean;
  business: string | boolean;
};

function resolveCompareCell(
  cell: string | boolean,
  membership: Record<AccountTypeKey, MembershipPricingPolicy>,
): string | boolean {
  if (typeof cell === 'boolean') return cell;
  return applyMembershipVars(cell, membership);
}

export function resolveCompareRows(
  config: Pick<PricingConfig, 'compareRows' | 'membership'>,
): ResolvedCompareRow[] {
  return config.compareRows.map((row) => ({
    feature: row.feature,
    group: row.group,
    individual: resolveCompareCell(row.individual, config.membership),
    pro: resolveCompareCell(row.pro, config.membership),
    business: resolveCompareCell(row.business, config.membership),
  }));
}

export function resolveFaqs(
  config: Pick<PricingConfig, 'faqs' | 'membership'>,
): FaqItemConfig[] {
  return config.faqs.map((item) => ({
    q: applyMembershipVars(item.q, config.membership),
    a: applyMembershipVars(item.a, config.membership),
  }));
}

export function resolvePlanShowcases(
  config: Pick<PricingConfig, 'showcases' | 'membership'>,
): ResolvedPlanShowcase[] {
  return (['individual', 'pro', 'business'] as AccountTypeKey[]).map((id) => {
    const raw = config.showcases[id];
    const apply = (s: string) => applyShowcaseVars(s, config.membership, id);
    return {
      id,
      name: raw.name,
      tagline: apply(raw.tagline),
      bestFor: raw.bestFor,
      priceLabel: raw.priceLabel,
      monthly: raw.monthly,
      yearly: raw.yearly,
      highlights: raw.highlights.map(apply),
      features: raw.features.map(apply),
      notIncluded: raw.notIncluded?.map(apply),
      ctaHint: apply(raw.ctaHint),
    };
  });
}

function normalizeCompareRow(raw: Partial<CompareRowConfig>): CompareRowConfig {
  return {
    feature: String(raw.feature ?? '').trim() || 'Quyền lợi',
    group: raw.group?.trim() || undefined,
    individual: normalizeCompareCell(raw.individual),
    pro: normalizeCompareCell(raw.pro),
    business: normalizeCompareCell(raw.business),
  };
}

function normalizeCompareCell(value: unknown): string | boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return String(value ?? '').trim();
}

function normalizeFaqItem(raw: Partial<FaqItemConfig>): FaqItemConfig {
  return {
    q: String(raw.q ?? '').trim() || 'Câu hỏi',
    a: String(raw.a ?? '').trim(),
  };
}

function normalizeShowcaseConfig(raw: Partial<PlanShowcaseConfig>): PlanShowcaseConfig {
  return {
    name: String(raw.name ?? '').trim() || 'Gói hội viên',
    tagline: String(raw.tagline ?? '').trim(),
    bestFor: String(raw.bestFor ?? '').trim(),
    priceLabel: String(raw.priceLabel ?? '').trim() || 'Miễn phí',
    monthly:
      raw.monthly != null && Number.isFinite(Number(raw.monthly))
        ? Math.max(0, Math.round(Number(raw.monthly)))
        : undefined,
    yearly:
      raw.yearly != null && Number.isFinite(Number(raw.yearly))
        ? Math.max(0, Math.round(Number(raw.yearly)))
        : undefined,
    highlights: normalizeStringList(raw.highlights),
    features: normalizeStringList(raw.features),
    notIncluded: raw.notIncluded?.length
      ? normalizeStringList(raw.notIncluded)
      : undefined,
    ctaHint: String(raw.ctaHint ?? '').trim(),
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => String(line ?? '').trim())
    .filter(Boolean);
}

function clampPercent(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}
