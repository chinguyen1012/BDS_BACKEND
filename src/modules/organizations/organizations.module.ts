import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Organization,
  OrganizationSchema,
} from './schemas/organization.schema';
import { OrganizationsService } from './organizations.service';
import {
  OrganizationsController,
  InvitationsController,
} from './organizations.controller';
import { OrgMembershipsModule } from '../org-memberships/org-memberships.module';
import { OrgInvitationsModule } from '../org-invitations/org-invitations.module';
import { OrgRolesModule } from '../org-roles/org-roles.module';
import {
  ApprovalWorkflow,
  ApprovalWorkflowSchema,
} from '../approval/schemas/approval-workflow.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from '../org-roles/schemas/org-role-template.schema';
import {
  OrgMembership,
  OrgMembershipSchema,
} from '../org-memberships/schemas/org-membership.schema';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import { Listing, ListingSchema } from '../listings/schemas/listing.schema';
import {
  OrgTransaction,
  OrgTransactionSchema,
} from '../org-wallet/schemas/org-transaction.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    OrgMembershipsModule,
    OrgInvitationsModule,
    OrgRolesModule,
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: ApprovalWorkflow.name, schema: ApprovalWorkflowSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
      { name: OrgMembership.name, schema: OrgMembershipSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: OrgTransaction.name, schema: OrgTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [OrganizationsController, InvitationsController],
  providers: [OrganizationsService, OrgContextGuard],
  exports: [OrganizationsService, MongooseModule],
})
export class OrganizationsModule {}
