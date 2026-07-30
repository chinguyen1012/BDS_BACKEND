import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Listing, ListingSchema } from '../listings/schemas/listing.schema';
import { ListingApprovalService } from './listing-approval.service';
import {
  ListingApprovalController,
  PlatformAdminListingsController,
} from './listing-approval.controller';
import { BudgetPoliciesModule } from '../budget-policies/budget-policies.module';
import { OrgWalletModule } from '../org-wallet/org-wallet.module';
import { TransactionsModule } from '../transactions/transactions.module';
import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from '../org-roles/schemas/org-role-template.schema';
import {
  OrgMembership,
  OrgMembershipSchema,
} from '../org-memberships/schemas/org-membership.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';

@Module({
  imports: [
    BudgetPoliciesModule,
    OrgWalletModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
      { name: OrgMembership.name, schema: OrgMembershipSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ListingApprovalController, PlatformAdminListingsController],
  providers: [ListingApprovalService, OrgContextGuard, PlatformAdminGuard],
  exports: [ListingApprovalService],
})
export class ApprovalModule {}
