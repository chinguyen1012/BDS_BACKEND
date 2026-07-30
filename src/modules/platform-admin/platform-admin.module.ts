import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminService } from './platform-admin.service';
import {
  PlatformAdminController,
  PublicSettingsController,
} from './platform-admin.controller';
import {
  PlatformAdmin,
  PlatformAdminSchema,
} from './schemas/platform-admin.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Organization,
  OrganizationSchema,
} from '../organizations/schemas/organization.schema';
import { Listing, ListingSchema } from '../listings/schemas/listing.schema';
import {
  PlatformSetting,
  PlatformSettingSchema,
} from '../auction/schemas/platform-setting.schema';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformAdmin.name, schema: PlatformAdminSchema },
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
    ]),
  ],
  controllers: [PlatformAdminController, PublicSettingsController],
  providers: [PlatformAdminService, PlatformAdminGuard],
  exports: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
