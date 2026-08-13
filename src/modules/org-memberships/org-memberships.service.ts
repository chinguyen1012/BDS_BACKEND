import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  OrgMembership,
  OrgMembershipDocument,
} from './schemas/org-membership.schema';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  OrgMembershipStatus,
  OrgRoleKey,
} from '../../common/enums/organization.enums';
import { OrgRolesService } from '../org-roles/org-roles.service';
import {
  Organization,
  OrganizationDocument,
} from '../organizations/schemas/organization.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateDocument,
} from '../org-roles/schemas/org-role-template.schema';

const REMOVABLE_BY: Record<string, OrgRoleKey[]> = {
  [OrgRoleKey.OWNER]: [OrgRoleKey.MANAGER, OrgRoleKey.STAFF],
  [OrgRoleKey.MANAGER]: [OrgRoleKey.STAFF],
};

@Injectable()
export class OrgMembershipsService {
  constructor(
    @InjectModel(OrgMembership.name)
    private readonly membershipModel: Model<OrgMembershipDocument>,
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(OrgRoleTemplate.name)
    private readonly roleModel: Model<OrgRoleTemplateDocument>,
    private readonly rolesService: OrgRolesService,
  ) {}

  private async getRoleKey(roleId: Types.ObjectId | string) {
    const role = await this.roleModel.findById(roleId).exec();
    return role?.key as OrgRoleKey | undefined;
  }

  private async assertCanRemoveMember(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
  ) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');

    if (org.ownerId.toString() === targetUserId) {
      throw new ForbiddenException('Không thể xóa Owner');
    }

    const [actorMembership, targetMembership] = await Promise.all([
      this.membershipModel
        .findOne({
          organizationId: new Types.ObjectId(organizationId),
          userId: new Types.ObjectId(actorUserId),
          status: OrgMembershipStatus.ACTIVE,
          deletedAt: null,
        })
        .exec(),
      this.membershipModel
        .findOne({
          organizationId: new Types.ObjectId(organizationId),
          userId: new Types.ObjectId(targetUserId),
          deletedAt: null,
        })
        .exec(),
    ]);

    if (!actorMembership) {
      throw new ForbiddenException('Bạn không thuộc Organization này');
    }
    if (!targetMembership) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    const actorKey =
      org.ownerId.toString() === actorUserId
        ? OrgRoleKey.OWNER
        : await this.getRoleKey(actorMembership.roleId);
    const targetKey = await this.getRoleKey(targetMembership.roleId);

    if (!actorKey || !targetKey) {
      throw new ForbiddenException('Không xác định được vai trò');
    }

    const allowed = REMOVABLE_BY[actorKey] ?? [];
    if (!allowed.includes(targetKey)) {
      throw new ForbiddenException(
        'Bạn không có quyền xóa thành viên với vai trò này',
      );
    }
  }

  async userOwnsOrganization(userId: string) {
    const org = await this.orgModel
      .findOne({ ownerId: new Types.ObjectId(userId), deletedAt: null })
      .exec();
    return Boolean(org);
  }

  /** User có phải Owner của org này không (theo ownerId). */
  async isOrganizationOwner(organizationId: string, userId: string) {
    if (
      !Types.ObjectId.isValid(organizationId) ||
      !Types.ObjectId.isValid(userId)
    ) {
      return false;
    }
    const org = await this.orgModel
      .findOne({
        _id: new Types.ObjectId(organizationId),
        ownerId: new Types.ObjectId(userId),
        deletedAt: null,
      })
      .select('_id')
      .lean()
      .exec();
    return Boolean(org);
  }

  async createOwnerMembership(organizationId: string, userId: string) {
    const ownerRole = await this.rolesService.findByKey(OrgRoleKey.OWNER);
    if (!ownerRole) {
      throw new NotFoundException('Không tìm thấy role Owner');
    }
    return this.membershipModel.create({
      userId: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
      roleId: ownerRole._id,
      permissions: [],
      status: OrgMembershipStatus.ACTIVE,
      joinedAt: new Date(),
    });
  }

  async createMembership(data: {
    organizationId: string;
    userId: string;
    roleId: string;
    invitedBy?: string;
  }) {
    const ownsOrg = await this.userOwnsOrganization(data.userId);
    if (ownsOrg) {
      throw new ForbiddenException(
        'Chủ Organization không thể gia nhập tổ chức khác',
      );
    }

    const exists = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(data.userId),
        organizationId: new Types.ObjectId(data.organizationId),
        deletedAt: null,
      })
      .exec();
    if (exists) {
      throw new ConflictException('User đã là thành viên');
    }
    return this.membershipModel.create({
      userId: new Types.ObjectId(data.userId),
      organizationId: new Types.ObjectId(data.organizationId),
      roleId: new Types.ObjectId(data.roleId),
      permissions: [],
      status: OrgMembershipStatus.ACTIVE,
      joinedAt: new Date(),
      invitedBy: data.invitedBy
        ? new Types.ObjectId(data.invitedBy)
        : undefined,
    });
  }

  findByUser(userId: string) {
    return this.membershipModel
      .find({
        userId: new Types.ObjectId(userId),
        status: OrgMembershipStatus.ACTIVE,
        deletedAt: null,
      })
      .populate('organizationId')
      .populate('roleId')
      .exec();
  }

  /** Owner hoặc Manager mới được thao tác quản lý tin org (vd: gia hạn). */
  async assertOwnerOrManager(organizationId: string, userId: string) {
    const ok = await this.isOwnerOrManager(organizationId, userId);
    if (!ok) {
      throw new ForbiddenException(
        'Chỉ Owner hoặc Manager mới được thao tác này',
      );
    }
  }

  async isOwnerOrManager(organizationId: string, userId: string) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) return false;

    if (org.ownerId.toString() === userId) return true;

    const membership = await this.membershipModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        userId: new Types.ObjectId(userId),
        status: OrgMembershipStatus.ACTIVE,
        deletedAt: null,
      })
      .exec();

    if (!membership) return false;

    const key = await this.getRoleKey(membership.roleId);
    return key === OrgRoleKey.OWNER || key === OrgRoleKey.MANAGER;
  }

  findByOrg(organizationId: string) {
    return this.membershipModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        deletedAt: null,
        status: { $ne: OrgMembershipStatus.LEFT },
      })
      .populate('userId', 'name email phone avatar')
      .populate('roleId')
      .exec();
  }

  async updateMember(
    organizationId: string,
    targetUserId: string,
    dto: UpdateMemberDto,
    actorUserId: string,
  ) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');

    if (org.ownerId.toString() === targetUserId && dto.status === 'left') {
      throw new ForbiddenException('Không thể remove Owner');
    }

    const membership = await this.membershipModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        userId: new Types.ObjectId(targetUserId),
        deletedAt: null,
      })
      .exec();

    if (!membership) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    if (dto.roleId) membership.roleId = new Types.ObjectId(dto.roleId);
    if (dto.status) membership.status = dto.status as OrgMembershipStatus;
    if (dto.permissions) membership.permissions = dto.permissions;

    await membership.save();
    return membership.populate(['userId', 'roleId']);
  }

  async removeMember(
    organizationId: string,
    targetUserId: string,
    actorUserId: string,
  ) {
    await this.assertCanRemoveMember(
      organizationId,
      actorUserId,
      targetUserId,
    );

    const membership = await this.membershipModel
      .findOneAndUpdate(
        {
          organizationId: new Types.ObjectId(organizationId),
          userId: new Types.ObjectId(targetUserId),
        },
        {
          status: OrgMembershipStatus.LEFT,
          deletedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!membership) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    return { removed: true, userId: targetUserId };
  }

  async getUserContexts(userId: string) {
    const ownsOrg = await this.userOwnsOrganization(userId);
    const memberships = await this.findByUser(userId);
    return {
      personal: { type: 'personal' as const, label: 'Cá nhân' },
      ownsOrganization: ownsOrg,
      organizations: memberships.map((m) => {
        const org = m.organizationId as unknown as OrganizationDocument;
        const role = m.roleId as unknown as { key?: string; name?: string };
        const isOwner = org.ownerId?.toString?.() === userId;
        return {
          id: org._id?.toString?.() ?? String(org),
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          role: isOwner ? 'owner' : role?.key,
          roleName: isOwner ? 'Owner' : role?.name,
          walletBalance: org.walletBalance,
          isOwner,
        };
      }),
    };
  }
}
