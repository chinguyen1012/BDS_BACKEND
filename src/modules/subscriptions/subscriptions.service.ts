import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { buildSubscriptionPlans } from './subscriptions.constants';
import { SubscribeDto } from './dto/subscribe.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { PricingService } from '../pricing/pricing.service';
import {
  addMembershipMonths,
  canRenewMembership,
  isMembershipActive,
  MEMBERSHIP_RENEW_WINDOW_DAYS,
  planRank,
} from '../users/membership.util';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly pricingService: PricingService,
  ) {}

  getPlans() {
    const config = this.pricingService.getConfig();
    return buildSubscriptionPlans(config);
  }

  async subscribe(userId: string, dto: SubscribeDto) {
    const plans = this.getPlans();
    const plan = plans.find((p) => p.id === dto.planId);
    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói đăng ký');
    }

    const user = await this.usersService.findOne(userId);
    const currentType = isMembershipActive(user)
      ? user.accountType
      : 'individual';
    const currentRank = planRank(currentType);
    const targetRank = planRank(plan.id);

    if (targetRank < currentRank) {
      throw new BadRequestException(
        `Bạn đang dùng gói ${currentType === 'business' ? 'Doanh nghiệp' : 'Pro'}. Không thể đăng ký gói thấp hơn khi gói hiện tại còn hạn.`,
      );
    }

    const isRenew = targetRank === currentRank && currentRank > 0;
    const isUpgrade = targetRank > currentRank && currentRank > 0;

    if (isRenew && !canRenewMembership(user.membershipExpiresAt)) {
      throw new BadRequestException(
        `Chỉ được gia hạn khi còn ${MEMBERSHIP_RENEW_WINDOW_DAYS} ngày trở xuống.`,
      );
    }
    const price = plan.monthly * dto.months;
    const monthsLabel = `${dto.months} tháng`;

    if (user.balance < price) {
      throw new BadRequestException(
        'Số dư không đủ. Vui lòng nạp thêm tiền để đăng ký gói.',
      );
    }

    const now = new Date();
    let expiresAt: Date;
    let note: string;

    if (isRenew) {
      const base =
        user.membershipExpiresAt &&
        user.membershipExpiresAt.getTime() > now.getTime()
          ? user.membershipExpiresAt
          : now;
      expiresAt = addMembershipMonths(base, dto.months);
      note = `Gia hạn ${plan.name} (${monthsLabel})`;
    } else if (isUpgrade) {
      expiresAt = addMembershipMonths(now, dto.months);
      note = `Nâng cấp lên ${plan.name} (${monthsLabel}) — hủy gói cũ, không hoàn thời gian còn lại`;
    } else {
      expiresAt = addMembershipMonths(now, dto.months);
      note = `Đăng ký ${plan.name} (${monthsLabel})`;
    }

    const { balance } = await this.transactionsService.spend(
      userId,
      price,
      note,
    );

    await user.updateOne({
      $set: {
        accountType: plan.accountType,
        membershipMonths: dto.months,
        membershipExpiresAt: expiresAt,
      },
      $unset: { membershipCycle: 1 },
    });
    user.accountType = plan.accountType;
    user.membershipMonths = dto.months;
    user.membershipExpiresAt = expiresAt;

    return {
      plan: plan.id,
      accountType: plan.accountType,
      action: isRenew ? 'renew' : isUpgrade ? 'upgrade' : 'subscribe',
      membershipMonths: dto.months,
      membershipExpiresAt: expiresAt,
      balance,
    };
  }
}
