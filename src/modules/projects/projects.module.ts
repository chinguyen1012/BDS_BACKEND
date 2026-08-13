import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformAdminModule } from '../platform-admin/platform-admin.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PublicProjectsController } from './public-projects.controller';
import { AdminProjectsController } from './admin-projects.controller';
import { ProjectsService } from './projects.service';
import { Project, ProjectSchema } from './schemas/project.schema';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PlatformAdminModule,
  ],
  controllers: [PublicProjectsController, AdminProjectsController],
  providers: [ProjectsService, PlatformAdminGuard],
  exports: [ProjectsService, MongooseModule],
})
export class ProjectsModule {}
