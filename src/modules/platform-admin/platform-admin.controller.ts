import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PlatformAdminService } from './platform-admin.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { RequirePlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { ListingStatus } from '../../common/enums/listing.enums';

@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.platformAdminService.getProfile(userId);
  }

  @Get('overview')
  @UseGuards(PlatformAdminGuard)
  @RequirePlatformAdmin()
  overview() {
    return this.platformAdminService.getOverview();
  }

  @Get('settings/pagination')
  @UseGuards(PlatformAdminGuard)
  @RequirePlatformAdmin()
  getPaginationSettings() {
    return this.platformAdminService.getPaginationSettings();
  }

  @Patch('settings/pagination')
  @UseGuards(PlatformAdminGuard)
  @RequirePlatformAdmin()
  updatePaginationSettings(@Body() body: { pageSize?: number }) {
    return this.platformAdminService.updatePaginationSettings(
      Number(body.pageSize),
    );
  }

  @Get('listings/all')
  @UseGuards(PlatformAdminGuard)
  @RequirePlatformAdmin()
  allListings(
    @Query('status') status?: ListingStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platformAdminService.listListings(status, page, limit);
  }
}

/** Public: dashboard lấy pageSize mặc định do admin cấu hình */
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('pagination')
  getPagination() {
    return this.platformAdminService.getPaginationSettings();
  }
}
