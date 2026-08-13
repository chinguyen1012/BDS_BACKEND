import type {
  AccountTypeKey,
  MembershipPricingPolicy,
  PlanShowcaseConfig,
  PricingConfig,
} from '../pricing/pricing.constants';
import {
  DEFAULT_PRICING_CONFIG,
  applyShowcaseVars,
} from '../pricing/pricing.constants';

export type SubscriptionPlan = {
  id: 'pro' | 'business';
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  accountType: 'pro' | 'business';
  features: string[];
  bestFor?: string;
  highlights?: string[];
  highlight?: boolean;
};

function mapPaidPlan(
  id: 'pro' | 'business',
  raw: PlanShowcaseConfig,
  membership: Record<AccountTypeKey, MembershipPricingPolicy>,
  highlight?: boolean,
): SubscriptionPlan {
  const apply = (s: string) => applyShowcaseVars(s, membership, id);
  return {
    id,
    name: raw.name,
    tagline: apply(raw.tagline),
    monthly: raw.monthly ?? 0,
    yearly: raw.yearly ?? 0,
    accountType: id,
    highlight,
    bestFor: raw.bestFor,
    highlights: raw.highlights.map(apply),
    features: raw.features.map(apply),
  };
}

/** Build plan API từ showcases admin (nguồn copy) + membership (%). */
export function buildSubscriptionPlans(
  config: Pick<PricingConfig, 'showcases' | 'membership'> = DEFAULT_PRICING_CONFIG,
): SubscriptionPlan[] {
  return [
    mapPaidPlan('pro', config.showcases.pro, config.membership, true),
    mapPaidPlan('business', config.showcases.business, config.membership),
  ];
}

/** @deprecated — prefer buildSubscriptionPlans(pricingConfig). */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = buildSubscriptionPlans();
