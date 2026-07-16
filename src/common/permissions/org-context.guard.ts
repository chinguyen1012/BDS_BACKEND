import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  ORG_CONTEXT_KEY,
  ORG_ID_HEADER,
  OrgContextPayload,
} from '../decorators/org-context.decorator';
import {
  PERMISSIONS_KEY,
  REQUIRE_ORG_CONTEXT_KEY,
} from '../decorators/require-permissions.decorator';
import { hasPermission, Permission } from './permission.constants';
import {
  OrgMembership,
  OrgMembershipDocument,
} from '../../modules/org-memberships/schemas/org-membership.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateDocument,
} from '../../modules/org-roles/schemas/org-role-template.schema';
import { OrgMembershipStatus } from '../enums/organization.enums';

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(OrgMembership.name)
    private readonly membershipModel: Model<OrgMembershipDocument>,
    @InjectModel(OrgRoleTemplate.name)
    private readonly roleModel: Model<OrgRoleTemplateDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireOrg = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ORG_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPerms = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireOrg && !requiredPerms?.length) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub as string | undefined;
    if (!userId) {
      throw new ForbiddenException('Vui lòng đăng nhập');
    }

    const orgId =
      (request.params?.orgId as string) ||
      (request.headers[ORG_ID_HEADER] as string) ||
      (request.body?.organizationId as string) ||
      (request.params?.id as string);

    if (!orgId) {
      throw new ForbiddenException('Thiếu Organization context');
    }

    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(orgId),
        status: OrgMembershipStatus.ACTIVE,
        deletedAt: null,
      })
      .exec();

    if (!membership) {
      throw new ForbiddenException('Bạn không thuộc Organization này');
    }

    const role = await this.roleModel.findById(membership.roleId).exec();
    const permissions = [
      ...(role?.permissions ?? []),
      ...(membership.permissions ?? []),
    ];

    const orgContext: OrgContextPayload = {
      organizationId: orgId,
      membershipId: membership._id.toString(),
      permissions,
      roleKey: role?.key ?? 'staff',
    };

    request[ORG_CONTEXT_KEY] = orgContext;

    if (requiredPerms?.length && !hasPermission(permissions, requiredPerms)) {
      throw new ForbiddenException('Không có quyền thực hiện thao tác này');
    }

    return true;
  }
}
