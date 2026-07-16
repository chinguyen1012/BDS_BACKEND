import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser('sub') userId: string, @Query('limit') limit?: string) {
    return this.notificationsService.listForUser(
      userId,
      limit ? Number(limit) : 50,
    );
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(userId, id);
  }
}
