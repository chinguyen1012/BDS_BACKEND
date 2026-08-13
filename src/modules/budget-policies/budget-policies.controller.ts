import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { BudgetPoliciesService } from './budget-policies.service';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import {
  RequireOrgContext,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:id/budget-policies')
@UseGuards(OrgContextGuard)
@RequireOrgContext()
export class BudgetPoliciesController {
  constructor(private readonly budgetService: BudgetPoliciesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_BUDGET_READ)
  list(@Param('id') orgId: string) {
    return this.budgetService.listByOrg(orgId);
  }

  @Get('me')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  getMyBudget(
    @Param('id') orgId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.budgetService.getMyBudgetUsage(orgId, userId);
  }

  @Get(':userId')
  @RequirePermissions(PERMISSIONS.ORG_BUDGET_READ)
  getUserPolicy(@Param('id') orgId: string, @Param('userId') userId: string) {
    return this.budgetService.getUserPolicy(orgId, userId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ORG_BUDGET_MANAGE)
  upsert(
    @Param('id') orgId: string,
    @CurrentUser('sub') actorId: string,
    @Body()
    body: {
      userId: string;
      limits: Record<string, number>;
    },
  ) {
    return this.budgetService.upsertUserPolicy(
      orgId,
      body.userId,
      body.limits as never,
      actorId,
    );
  }
}
