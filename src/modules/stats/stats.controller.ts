import { Controller, Get } from '@nestjs/common';

import { StatsService } from './stats.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@CurrentUser('sub') userId: string) {
    return this.statsService.overview(userId);
  }
}
