import { Body, Controller, Get, Post } from '@nestjs/common';

import { SubscriptionsService } from './subscriptions.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.subscriptionsService.subscribe(userId, dto);
  }
}

/** @deprecated Alias — dùng /subscriptions */
@Controller('memberships')
export class MembershipsLegacyController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.subscriptionsService.subscribe(userId, dto);
  }
}
