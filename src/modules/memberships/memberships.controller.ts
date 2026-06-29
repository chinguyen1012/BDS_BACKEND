import { Body, Controller, Get, Post } from '@nestjs/common';

import { MembershipsService } from './memberships.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Public()
  @Get('plans')
  getPlans() {
    return this.membershipsService.getPlans();
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubscribeDto,
  ) {
    return this.membershipsService.subscribe({ ...dto, owner: userId });
  }
}
