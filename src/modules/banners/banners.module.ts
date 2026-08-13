import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminBannersController } from './admin-banners.controller';
import { BannersService } from './banners.service';
import { PublicBannersController } from './public-banners.controller';
import { Banner, BannerSchema } from './schemas/banner.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Banner.name, schema: BannerSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PlatformAdminModule,
  ],
  controllers: [PublicBannersController, AdminBannersController],
  providers: [BannersService, PlatformAdminGuard],
  exports: [BannersService],
})
export class BannersModule {}
