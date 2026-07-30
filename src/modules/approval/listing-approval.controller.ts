import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ListingApprovalService } from './listing-approval.service';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import {
  RequireOrgContext,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { RequirePlatformAdmin } from '../../common/decorators/platform-admin.decorator';

@Controller('listings')
export class ListingApprovalController {
  constructor(private readonly approvalService: ListingApprovalService) {}

  @Get('org/:orgId/pending-manager')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.LISTING_APPROVE_MANAGER)
  pendingManager(@Param('orgId') orgId: string) {
    return this.approvalService.listPendingForManager(orgId);
  }

  @Post(':id/approve/manager')
  @UseGuards(OrgContextGuard)
  @RequirePermissions(PERMISSIONS.LISTING_APPROVE_MANAGER)
  approveManager(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { note?: string; organizationId?: string },
  ) {
    return this.approvalService.approveByManager(id, userId, body.note);
  }

  @Post(':id/reject/manager')
  @UseGuards(OrgContextGuard)
  @RequirePermissions(PERMISSIONS.LISTING_APPROVE_MANAGER)
  rejectManager(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { note?: string; organizationId?: string },
  ) {
    return this.approvalService.rejectByManager(id, userId, body.note);
  }
}

@Controller('platform-admin/listings')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class PlatformAdminListingsController {
  constructor(private readonly approvalService: ListingApprovalService) {}

  @Get('pending')
  pending(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.approvalService.listPendingForPlatform(page, limit);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { note?: string },
  ) {
    return this.approvalService.approveByPlatform(id, userId, body.note);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { note?: string },
  ) {
    return this.approvalService.rejectByPlatform(id, userId, body.note);
  }
}
