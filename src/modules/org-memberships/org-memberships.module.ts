import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  OrgMembership,
  OrgMembershipSchema,
} from './schemas/org-membership.schema';
import { OrgMembershipsService } from './org-memberships.service';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import { OrgRolesModule } from '../org-roles/org-roles.module';
import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from '../org-roles/schemas/org-role-template.schema';

@Module({
  imports: [
    OrgRolesModule,
    MongooseModule.forFeature([
      { name: OrgMembership.name, schema: OrgMembershipSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
    ]),
  ],
  providers: [OrgMembershipsService],
  exports: [OrgMembershipsService, MongooseModule],
})
export class OrgMembershipsModule {}
