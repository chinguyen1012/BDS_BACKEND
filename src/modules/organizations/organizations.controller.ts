import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import {
  RequireOrgContext,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { OrgRoleKey } from '../../common/enums/organization.enums';
import { OrgMembershipsService } from '../org-memberships/org-memberships.service';
import { OrgInvitationsService } from '../org-invitations/org-invitations.service';
import { OrgRolesService } from '../org-roles/org-roles.service';
import { CreateInvitationDto } from '../org-invitations/dto/create-invitation.dto';
import { UpdateMemberDto } from '../org-memberships/dto/update-member.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly orgsService: OrganizationsService,
    private readonly membershipsService: OrgMembershipsService,
    private readonly invitationsService: OrgInvitationsService,
    private readonly rolesService: OrgRolesService,
  ) {}

  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgsService.create(userId, dto);
  }

  @Get()
  findMine(@CurrentUser('sub') userId: string) {
    return this.orgsService.findAllForUser(userId);
  }

  @Get(':id')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_READ)
  findOne(@Param('id') id: string) {
    return this.orgsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.orgsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.orgsService.softDelete(id, userId);
  }

  @Get(':id/members')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_LIST)
  listMembers(@Param('id') id: string) {
    return this.membershipsService.findByOrg(id);
  }

  @Patch(':id/members/:userId')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_UPDATE_ROLE)
  updateMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.membershipsService.updateMember(id, targetUserId, dto, actorId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_REMOVE)
  removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.membershipsService.removeMember(id, targetUserId, actorId);
  }

  @Post(':id/invitations')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_INVITE)
  invite(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(id, userId, dto);
  }

  @Get(':id/invitations')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_LIST)
  listInvitations(@Param('id') id: string) {
    return this.invitationsService.findPendingByOrganization(id);
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_INVITE)
  revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationsService.revoke(id, invitationId);
  }

  @Get(':id/roles')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_READ)
  listRoles(@Param('id') id: string) {
    return this.rolesService
      .findByOrg(id)
      .then((roles) =>
        roles.filter((r) =>
          [OrgRoleKey.OWNER, OrgRoleKey.MANAGER, OrgRoleKey.STAFF].includes(
            r.key as OrgRoleKey,
          ),
        ),
      );
  }

  @Get(':id/dashboard/overview')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  dashboardOverview(@Param('id') id: string) {
    return this.orgsService.getDashboardOverview(id);
  }

  @Get(':id/my-listings')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  myListings(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Query('status') status?: string,
  ) {
    return this.orgsService.listOrgListings(id, {
      postedBy: userId,
      status,
    });
  }

  @Get(':id/members/:userId/listings')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_LIST)
  memberListings(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.orgsService.listOrgListings(id, { postedBy: userId });
  }

  @Get(':id/listings')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.LISTING_APPROVE_MANAGER)
  orgListings(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('pending') pending?: string,
  ) {
    return this.orgsService.listOrgListings(id, {
      status,
      pendingOnly: pending === 'true',
    });
  }

  @Get(':id/analytics/chart')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.DASHBOARD_ANALYTICS)
  analyticsChart(
    @Param('id') id: string,
    @Query('period') period?: 'day' | 'month' | 'year',
  ) {
    return this.orgsService.getAnalyticsChart(id, period ?? 'month');
  }

  @Get(':id/analytics/members')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.ORG_MEMBERS_LIST)
  memberAnalytics(
    @Param('id') id: string,
    @Query('period') period?: 'day' | 'month' | 'year',
  ) {
    return this.orgsService.getMemberAnalytics(id, period ?? 'month');
  }

  @Get(':id/analytics')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.DASHBOARD_ANALYTICS)
  analytics(
    @Param('id') id: string,
    @Query('period') period?: 'day' | 'month' | 'year',
  ) {
    return this.orgsService.getAnalyticsReport(id, period ?? 'month');
  }
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: OrgInvitationsService) {}

  @Get('pending')
  findPending(@CurrentUser('sub') userId: string) {
    return this.invitationsService.findPendingForUser(userId);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser('sub') userId: string) {
    return this.invitationsService.accept(token, userId);
  }

  @Post(':token/reject')
  reject(@Param('token') token: string, @CurrentUser('sub') userId: string) {
    return this.invitationsService.reject(token, userId);
  }
}
