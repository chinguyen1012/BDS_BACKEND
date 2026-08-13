import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { setListingPriceUtilConfig } from '../../common/utils/listing-price.util';
import {
  PlatformSetting,
  PlatformSettingDocument,
} from '../auction/schemas/platform-setting.schema';
import {
  AccountTypeKey,
  DEFAULT_PRICING_CONFIG,
  DurationOptionConfig,
  ListingPackageKey,
  PricingConfig,
  mergePricingConfig,
  normalizeAccountTypeKey,
  normalizePackageKey,
  resolvePlanShowcases,
  resolveCompareRows,
  resolveFaqs,
} from './pricing.constants';

export type ListingQuote = {
  package: ListingPackageKey;
  duration: number;
  accountType: AccountTypeKey;
  /** Giá niêm yết của option (trước giảm membership). */
  listPrice: number;
  durationDiscountPercent: number;
  membershipDiscountPercent: number;
  afterDurationDiscount: number;
  total: number;
  dailyPrice: number;
  currency: 'VND';
  free: boolean;
};

export type AuctionQuote = {
  accountType: AccountTypeKey;
  dailyBidAmount: number;
  durationDays: number;
  auctionFeeDiscountPercent: number;
  grossHold: number;
  holdAmount: number;
  competitiveDailyBid: number;
  currency: 'VND';
};

const PRICING_KEY = 'pricing';

@Injectable()
export class PricingService implements OnModuleInit {
  private config: PricingConfig = structuredClone(DEFAULT_PRICING_CONFIG);

  constructor(
    @InjectModel(PlatformSetting.name)
    private readonly settingModel: Model<PlatformSettingDocument>,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload() {
    const doc = await this.settingModel
      .findOne({ key: PRICING_KEY })
      .lean()
      .exec();
    if (!doc) {
      this.config = structuredClone(DEFAULT_PRICING_CONFIG);
      await this.settingModel.create({
        key: PRICING_KEY,
        packages: DEFAULT_PRICING_CONFIG.packages,
        membership: DEFAULT_PRICING_CONFIG.membership,
        showcases: DEFAULT_PRICING_CONFIG.showcases,
        compareRows: DEFAULT_PRICING_CONFIG.compareRows,
        faqs: DEFAULT_PRICING_CONFIG.faqs,
      });
      setListingPriceUtilConfig(this.config);
      return this.config;
    }
    this.config = mergePricingConfig({
      packages: doc.packages as PricingConfig['packages'],
      membership: doc.membership as PricingConfig['membership'],
      showcases: doc.showcases as PricingConfig['showcases'],
      compareRows: doc.compareRows as PricingConfig['compareRows'],
      faqs: doc.faqs as PricingConfig['faqs'],
    });
    setListingPriceUtilConfig(this.config);
    return this.config;
  }

  getConfig(): PricingConfig {
    return this.config;
  }

  async updateConfig(partial: Partial<PricingConfig>) {
    const next = mergePricingConfig({
      packages: partial.packages ?? this.config.packages,
      membership: partial.membership ?? this.config.membership,
      showcases: partial.showcases ?? this.config.showcases,
      compareRows: partial.compareRows ?? this.config.compareRows,
      faqs: partial.faqs ?? this.config.faqs,
    });

    await this.settingModel.findOneAndUpdate(
      { key: PRICING_KEY },
      {
        $set: {
          packages: next.packages,
          membership: next.membership,
          showcases: next.showcases,
          compareRows: next.compareRows,
          faqs: next.faqs,
        },
      },
      { upsert: true, new: true },
    );

    this.config = next;
    setListingPriceUtilConfig(this.config);
    return this.config;
  }

  findDurationOption(
    pkg: ListingPackageKey,
    days: number,
  ): DurationOptionConfig | undefined {
    return this.config.packages[pkg]?.durations?.find((d) => d.days === days);
  }

  quoteListing(
    pkg: string | undefined,
    duration: number | string | undefined,
    accountType?: string | null,
  ): ListingQuote {
    const packageKey = normalizePackageKey(pkg);
    const account = normalizeAccountTypeKey(accountType);
    const durations = this.config.packages[packageKey].durations;
    const daysRequested = Number(duration);
    const option = Number.isFinite(daysRequested)
      ? durations.find((d) => d.days === daysRequested)
      : undefined;

    if (!option) {
      const allowed = durations.map((d) => d.days).join(', ');
      throw new BadRequestException(
        `Số ngày không hợp lệ cho gói ${packageKey}. Chọn một trong: ${allowed || '—'}.`,
      );
    }

    const days = option.days;
    const listPrice = Math.max(0, Math.round(option.price));
    const free = listPrice <= 0;
    const policy = this.config.membership[account];

    // Giảm membership áp dụng khi có phí (kể cả tin thường trả phí).
    const membershipDiscountPercent = free
      ? 0
      : policy.listingDiscountPercent;

    const afterDurationDiscount = listPrice;
    const total = free
      ? 0
      : Math.round(listPrice * (1 - membershipDiscountPercent / 100));

    return {
      package: packageKey,
      duration: days,
      accountType: account,
      listPrice,
      durationDiscountPercent: 0,
      membershipDiscountPercent,
      afterDurationDiscount,
      total,
      dailyPrice: days > 0 ? Math.round(listPrice / days) : 0,
      currency: 'VND',
      free,
    };
  }

  calcListingTotal(
    pkg?: string,
    duration?: number | string,
    accountType?: string | null,
  ): number {
    return this.quoteListing(pkg, duration, accountType).total;
  }

  quoteAuction(
    dailyBidAmount: number,
    durationDays: number,
    accountType?: string | null,
  ): AuctionQuote {
    const account = normalizeAccountTypeKey(accountType);
    const daily = Math.max(0, Math.round(dailyBidAmount));
    const days = Math.max(1, Math.round(Number(durationDays) || 1));
    const policy = this.config.membership[account];
    const grossHold = daily * days;
    const holdAmount = Math.round(
      grossHold * (1 - policy.auctionFeeDiscountPercent / 100),
    );

    return {
      accountType: account,
      dailyBidAmount: daily,
      durationDays: days,
      auctionFeeDiscountPercent: policy.auctionFeeDiscountPercent,
      grossHold,
      holdAmount,
      competitiveDailyBid: daily,
      currency: 'VND',
    };
  }

  getPolicies() {
    return {
      ...this.config,
      planShowcases: resolvePlanShowcases(this.config),
      compareRows: resolveCompareRows(this.config),
      faqs: resolveFaqs(this.config),
      /** Tương thích FE cũ */
      packageDailyPrices: {
        standard: this.estimateDaily('standard'),
        vip: this.estimateDaily('vip'),
        diamond: this.estimateDaily('diamond'),
      },
      durationDiscountPercent: {} as Record<number, number>,
    };
  }

  private estimateDaily(pkg: ListingPackageKey) {
    const paid = this.config.packages[pkg].durations.find((d) => d.price > 0);
    if (!paid) return 0;
    return Math.round(paid.price / paid.days);
  }
}
