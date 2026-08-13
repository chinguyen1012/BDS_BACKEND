import type { UserDocument } from './schemas/user.schema';

export type PaidAccountType = 'pro' | 'business';
export type MembershipMonths = 1 | 3 | 6;

export const MEMBERSHIP_MONTH_OPTIONS: MembershipMonths[] = [1, 3, 6];
/** Chỉ được gia hạn khi còn ≤ số ngày này. */
export const MEMBERSHIP_RENEW_WINDOW_DAYS = 15;

const PLAN_RANK: Record<string, number> = {
  individual: 0,
  pro: 1,
  business: 2,
};

export function planRank(type?: string | null): number {
  return PLAN_RANK[type ?? ''] ?? 0;
}

export function isPaidAccountType(type?: string | null): type is PaidAccountType {
  return type === 'pro' || type === 'business';
}

/** User cũ chưa có ngày hết hạn vẫn được coi là còn hạn. */
export function isMembershipActive(user: {
  accountType?: string | null;
  membershipExpiresAt?: Date | string | null;
}): boolean {
  if (!isPaidAccountType(user.accountType)) return false;
  if (!user.membershipExpiresAt) return true;
  return new Date(user.membershipExpiresAt).getTime() > Date.now();
}

export function membershipRemainingDays(
  expiresAt?: Date | string | null,
): number | null {
  if (!expiresAt) return null;
  return Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
  );
}

export function canRenewMembership(expiresAt?: Date | string | null): boolean {
  const days = membershipRemainingDays(expiresAt);
  if (days === null) return false;
  return days <= MEMBERSHIP_RENEW_WINDOW_DAYS;
}

export function addMembershipMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function expireMembershipIfNeeded(
  user: UserDocument,
): Promise<UserDocument> {
  if (
    isPaidAccountType(user.accountType) &&
    user.membershipExpiresAt &&
    user.membershipExpiresAt.getTime() <= Date.now()
  ) {
    user.accountType = 'individual';
    user.membershipCycle = undefined;
    user.membershipMonths = undefined;
    await user.updateOne({
      $set: { accountType: 'individual' },
      $unset: { membershipCycle: 1, membershipMonths: 1 },
    });
  }
  return user;
}
