import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { AuditLogsService } from './audit-logs.service';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import {
  RequireOrgContext,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@Controller('organizations/:id/audit-logs')
@UseGuards(OrgContextGuard)
@RequireOrgContext()
export class AuditLogsController {
  constructor(private readonly auditService: AuditLogsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_VIEW)
  list(@Param('id') orgId: string, @Query('limit') limit?: string) {
    return this.auditService.findByOrg(orgId, limit ? Number(limit) : 100);
  }
}
