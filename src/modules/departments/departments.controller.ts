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

import { DepartmentsService } from './departments.service';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import {
  RequireOrgContext,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@Controller('organizations/:id')
@UseGuards(OrgContextGuard)
@RequireOrgContext()
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get('departments')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  listDepartments(@Param('id') orgId: string) {
    return this.departmentsService.listDepartments(orgId);
  }

  @Post('departments')
  @RequirePermissions(PERMISSIONS.ORG_SETTINGS)
  createDepartment(
    @Param('id') orgId: string,
    @Body() body: { name: string; description?: string },
  ) {
    return this.departmentsService.createDepartment(
      orgId,
      body.name,
      body.description,
    );
  }

  @Patch('departments/:deptId')
  @RequirePermissions(PERMISSIONS.ORG_SETTINGS)
  updateDepartment(
    @Param('id') orgId: string,
    @Param('deptId') deptId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.departmentsService.updateDepartment(orgId, deptId, body);
  }

  @Delete('departments/:deptId')
  @RequirePermissions(PERMISSIONS.ORG_SETTINGS)
  deleteDepartment(
    @Param('id') orgId: string,
    @Param('deptId') deptId: string,
  ) {
    return this.departmentsService.deleteDepartment(orgId, deptId);
  }

  @Get('teams')
  @RequirePermissions(PERMISSIONS.ORG_READ)
  listTeams(
    @Param('id') orgId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.departmentsService.listTeams(orgId, departmentId);
  }

  @Post('teams')
  @RequirePermissions(PERMISSIONS.ORG_SETTINGS)
  createTeam(
    @Param('id') orgId: string,
    @Body() body: { departmentId: string; name: string },
  ) {
    return this.departmentsService.createTeam(
      orgId,
      body.departmentId,
      body.name,
    );
  }
}
