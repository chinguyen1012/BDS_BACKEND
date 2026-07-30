import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { Listing, ListingSchema } from '../listings/schemas/listing.schema';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import {
  OrgTransaction,
  OrgTransactionSchema,
} from '../org-wallet/schemas/org-transaction.schema';
import {
  OrgMembership,
  OrgMembershipSchema,
} from '../org-memberships/schemas/org-membership.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from '../org-roles/schemas/org-role-template.schema';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import { AdminAuctionController } from './admin-auction.controller';
import { AuctionController } from './auction.controller';
import { AuctionService } from './auction.service';
import { PublicAuctionController } from './public-auction.controller';
import {
  ListingAuctionBid,
  ListingAuctionBidSchema,
} from './schemas/listing-auction-bid.schema';
import {
  PlatformSetting,
  PlatformSettingSchema,
} from './schemas/platform-setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
      { name: ListingAuctionBid.name, schema: ListingAuctionBidSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: OrgTransaction.name, schema: OrgTransactionSchema },
      { name: OrgMembership.name, schema: OrgMembershipSchema },
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
    ]),
    UsersModule,
    PlatformAdminModule,
  ],
  controllers: [
    PublicAuctionController,
    AuctionController,
    AdminAuctionController,
  ],
  providers: [AuctionService, PlatformAdminGuard, OrgContextGuard],
  exports: [AuctionService],
})
export class AuctionModule {}
