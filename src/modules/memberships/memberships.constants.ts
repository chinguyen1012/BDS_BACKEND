export type MembershipPlan = {
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

/** @deprecated — dùng SUBSCRIPTION_PLANS */
export { SUBSCRIPTION_PLANS as MEMBERSHIP_PLANS } from '../subscriptions/subscriptions.constants';
