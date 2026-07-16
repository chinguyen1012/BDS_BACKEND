import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  OrgRoleTemplate,
  OrgRoleTemplateDocument,
} from './schemas/org-role-template.schema';
import { SYSTEM_ROLE_PERMISSIONS } from '../../common/permissions/permission.constants';
import { OrgRoleKey } from '../../common/enums/organization.enums';

@Injectable()
export class OrgRolesService implements OnModuleInit {
  constructor(
    @InjectModel(OrgRoleTemplate.name)
    private readonly roleModel: Model<OrgRoleTemplateDocument>,
  ) {}

  async onModuleInit() {
    await this.seedSystemRoles();
  }

  async seedSystemRoles() {
    for (const [key, def] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      await this.roleModel
        .updateOne(
          { organizationId: null, key, isSystem: true },
          {
            $set: {
              name: def.name,
              description: def.description,
              permissions: def.permissions,
            },
            $setOnInsert: {
              organizationId: null,
              key,
              isSystem: true,
              isDefault: key === OrgRoleKey.STAFF,
            },
          },
          { upsert: true },
        )
        .exec();
    }
  }

  findSystemRoles() {
    return this.roleModel.find({ organizationId: null, isSystem: true }).exec();
  }

  findByOrg(organizationId: string) {
    return this.roleModel
      .find({
        $or: [{ organizationId: null, isSystem: true }, { organizationId }],
      })
      .exec();
  }

  findByKey(key: string, organizationId?: string | null) {
    return this.roleModel
      .findOne({
        key,
        $or: [{ organizationId: null, isSystem: true }, { organizationId }],
      })
      .sort({ organizationId: -1 })
      .exec();
  }

  findById(id: string) {
    return this.roleModel.findById(id).exec();
  }
}
