import { Controller, Get, Query, UseGuards } from '@nestjs/common';

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

  @Get('listings/all')
  @UseGuards(PlatformAdminGuard)
  @RequirePlatformAdmin()
  allListings(@Query('status') status?: ListingStatus) {
    return this.platformAdminService.listListings(status);
  }
}
