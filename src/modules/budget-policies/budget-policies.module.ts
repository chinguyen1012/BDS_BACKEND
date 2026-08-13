import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  BudgetPolicy,
  BudgetPolicySchema,
} from './schemas/budget-policy.schema';
import { BudgetPoliciesService } from './budget-policies.service';
import { BudgetPoliciesController } from './budget-policies.controller';
import { Listing, ListingSchema } from '../listings/schemas/listing.schema';
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
      { name: BudgetPolicy.name, schema: BudgetPolicySchema },
      { name: Listing.name, schema: ListingSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
      { name: OrgMembership.name, schema: OrgMembershipSchema },
    ]),
  ],
  controllers: [BudgetPoliciesController],
  providers: [BudgetPoliciesService, OrgContextGuard],
  exports: [BudgetPoliciesService],
})
export class BudgetPoliciesModule {}
