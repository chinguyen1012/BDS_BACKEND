import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  OrgRoleTemplate,
  OrgRoleTemplateSchema,
} from './schemas/org-role-template.schema';
import { OrgRolesService } from './org-roles.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrgRoleTemplate.name, schema: OrgRoleTemplateSchema },
    ]),
  ],
  providers: [OrgRolesService],
  exports: [OrgRolesService, MongooseModule],
})
export class OrgRolesModule {}
