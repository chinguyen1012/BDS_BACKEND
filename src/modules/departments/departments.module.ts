import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Department, DepartmentSchema } from './schemas/department.schema';
import { Team, TeamSchema } from './schemas/team.schema';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';
import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from '../org-roles/schemas/org-role-template.schema';
import {
  OrgMembership,
  OrgMembershipSchema,
} from '../org-memberships/schemas/org-membership.schema';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: Team.name, schema: TeamSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
      { name: OrgMembership.name, schema: OrgMembershipSchema },
    ]),
  ],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, OrgContextGuard],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
