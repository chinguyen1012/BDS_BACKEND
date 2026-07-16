import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { SUBSCRIPTION_PLANS } from './subscriptions.constants';
import { SubscribeDto } from './dto/subscribe.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  getPlans() {
    return SUBSCRIPTION_PLANS;
  }

  async subscribe(userId: string, dto: SubscribeDto) {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === dto.planId);
    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói đăng ký');
    }

    const user = await this.usersService.findOne(userId);

    if (plan.id === 'business' && user.accountType === 'business') {
      throw new BadRequestException('Bạn đã có gói Tài khoản Doanh nghiệp');
    }

    const price = dto.cycle === 'monthly' ? plan.monthly : plan.yearly;

    if (user.balance < price) {
      throw new BadRequestException(
        'Số dư không đủ. Vui lòng nạp thêm tiền để đăng ký gói.',
      );
    }

    const { balance } = await this.transactionsService.spend(
      userId,
      price,
      `Đăng ký ${plan.name} (${dto.cycle === 'monthly' ? 'theo tháng' : 'theo năm'})`,
    );

    user.accountType = plan.accountType;
    await user.save();

    return { plan: plan.id, accountType: plan.accountType, balance };
  }
}
