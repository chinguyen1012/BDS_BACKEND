import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  OrgTransaction,
  OrgTransactionSchema,
} from './schemas/org-transaction.schema';
import { OrgWalletService } from './org-wallet.service';
import { OrgWalletController } from './org-wallet.controller';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { TransactionsModule } from '../transactions/transactions.module';
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
    forwardRef(() => PaymentsModule),
    UsersModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: OrgTransaction.name, schema: OrgTransactionSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
      { name: OrgMembership.name, schema: OrgMembershipSchema },
    ]),
  ],
  controllers: [OrgWalletController],
  providers: [OrgWalletService, OrgContextGuard],
  exports: [OrgWalletService, MongooseModule],
})
export class OrgWalletModule {}
