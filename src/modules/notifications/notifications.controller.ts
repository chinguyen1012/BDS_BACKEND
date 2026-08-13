import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread-count')
  unreadCount(
    @CurrentUser('sub') userId: string,
    @Query('category') category?: string,
  ) {
    return this.notificationsService.unreadCount(userId, category);
  }

  @Patch('read-all')
  markAllRead(
    @CurrentUser('sub') userId: string,
    @Query('category') category?: string,
  ) {
    return this.notificationsService.markAllRead(userId, category);
  }

  @Get()
  list(
    @CurrentUser('sub') userId: string,
    @Query('category') category?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.notificationsService.listForUser(userId, {
      category,
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      limit: limit ? Number(limit) : 50,
      page: page ? Number(page) : 1,
    });
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(userId, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.remove(userId, id);
  }
}
