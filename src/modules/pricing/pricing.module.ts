import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import {
  PlatformSetting,
  PlatformSettingSchema,
} from '../auction/schemas/platform-setting.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  AdminPricingController,
  PricingController,
} from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PlatformAdminModule,
  ],
  controllers: [PricingController, AdminPricingController],
  providers: [PricingService, PlatformAdminGuard],
  exports: [PricingService],
})
export class PricingModule {}
