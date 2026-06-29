import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { MEMBERSHIP_PLANS } from './memberships.constants';
import { SubscribeDto } from './dto/subscribe.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { DEMO_USER_ID } from '../../common/constants';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  getPlans() {
    return MEMBERSHIP_PLANS;
  }

  async subscribe(dto: SubscribeDto) {
    const owner = dto.owner ?? DEMO_USER_ID;
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === dto.planId);
    if (!plan) {
      throw new NotFoundException('Không tìm thấy gói hội viên');
    }

    const price = dto.cycle === 'monthly' ? plan.monthly : plan.yearly;
    const user = await this.usersService.findOne(owner);

    if (user.balance < price) {
      throw new BadRequestException(
        'Số dư không đủ. Vui lòng nạp thêm tiền để đăng ký gói.',
      );
    }

    const { balance } = await this.transactionsService.spend(
      owner,
      price,
      `Đăng ký ${plan.name} (${dto.cycle === 'monthly' ? 'theo tháng' : 'theo năm'})`,
    );

    user.accountType = plan.accountType;
    await user.save();

    return { plan: plan.id, accountType: plan.accountType, balance };
  }
}
