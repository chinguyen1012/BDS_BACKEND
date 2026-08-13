import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminHelpController } from './admin-help.controller';
import { HelpService } from './help.service';
import { PublicHelpController } from './public-help.controller';
import {
  HelpArticle,
  HelpArticleSchema,
} from './schemas/help-article.schema';
import {
  HelpCategory,
  HelpCategorySchema,
} from './schemas/help-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HelpArticle.name, schema: HelpArticleSchema },
      { name: HelpCategory.name, schema: HelpCategorySchema },
      { name: User.name, schema: UserSchema },
    ]),
    PlatformAdminModule,
  ],
  controllers: [PublicHelpController, AdminHelpController],
  providers: [HelpService, PlatformAdminGuard],
  exports: [HelpService],
})
export class HelpModule {}
