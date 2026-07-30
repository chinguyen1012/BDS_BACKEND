import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminNewsController } from './admin-news.controller';
import { NewsService } from './news.service';
import { PublicNewsController } from './public-news.controller';
import { NewsArticle, NewsArticleSchema } from './schemas/news.schema';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NewsArticle.name, schema: NewsArticleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PlatformAdminModule,
  ],
  controllers: [PublicNewsController, AdminNewsController],
  providers: [NewsService, PlatformAdminGuard],
  exports: [NewsService],
})
export class NewsModule {}
