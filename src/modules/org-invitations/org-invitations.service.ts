import { randomBytes } from 'crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  OrgInvitation,
  OrgInvitationDocument,
} from './schemas/org-invitation.schema';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { OrgInvitationStatus } from '../../common/enums/organization.enums';
import { OrgMembershipsService } from '../org-memberships/org-memberships.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Organization,
  OrganizationDocument,
} from '../organizations/schemas/organization.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateDocument,
} from '../org-roles/schemas/org-role-template.schema';
import { NotificationsService } from '../notifications/notifications.service';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class OrgInvitationsService {
  constructor(
    @InjectModel(OrgInvitation.name)
    private readonly invitationModel: Model<OrgInvitationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(OrgRoleTemplate.name)
    private readonly roleModel: Model<OrgRoleTemplateDocument>,
    private readonly membershipsService: OrgMembershipsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    organizationId: string,
    invitedBy: string,
    dto: CreateInvitationDto,
  ) {
    const email = dto.email.toLowerCase().trim();
    const role = await this.roleModel.findById(dto.roleId).exec();
    if (!role || !['manager', 'staff'].includes(String(role.key))) {
      throw new BadRequestException('Chỉ có thể mời vai trò Manager hoặc Staff');
    }

    const existing = await this.invitationModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        email,
        status: OrgInvitationStatus.PENDING,
      })
      .exec();
    if (existing) {
      throw new BadRequestException('Đã gửi lời mời cho email này');
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invitation = await this.invitationModel.create({
      organizationId: new Types.ObjectId(organizationId),
      email,
      roleId: new Types.ObjectId(dto.roleId),
      invitedBy: new Types.ObjectId(invitedBy),
      token,
      status: OrgInvitationStatus.PENDING,
      expiresAt,
    });

    const [org, invitee] = await Promise.all([
      this.orgModel.findById(organizationId).exec(),
      this.userModel.findOne({ email }).exec(),
    ]);

    if (invitee) {
      await this.notificationsService.create({
        userId: invitee._id.toString(),
        organizationId,
        type: 'org_invitation',
        title: 'Lời mời tham gia Organization',
        body: `${org?.name ?? 'Một Organization'} mời bạn tham gia với vai trò ${role?.name ?? 'Thành viên'}.`,
        payload: {
          invitationToken: token,
          organizationId,
          organizationName: org?.name,
          roleName: role?.name,
          href: '/dashboard/notifications',
        },
      });
    }

    return invitation;
  }

  findPendingByOrganization(organizationId: string) {
    return this.invitationModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        status: OrgInvitationStatus.PENDING,
      })
      .sort({ createdAt: -1 })
      .populate('roleId', 'name key')
      .populate('invitedBy', 'name email')
      .exec();
  }

  async revoke(organizationId: string, invitationId: string) {
    const invitation = await this.invitationModel
      .findOne({
        _id: new Types.ObjectId(invitationId),
        organizationId: new Types.ObjectId(organizationId),
        status: OrgInvitationStatus.PENDING,
      })
      .exec();

    if (!invitation) {
      throw new NotFoundException('Không tìm thấy lời mời hoặc đã được xử lý');
    }

    invitation.status = OrgInvitationStatus.REVOKED;
    await invitation.save();

    return { revoked: true, id: invitationId };
  }

  findPendingByEmail(email: string) {
    return this.invitationModel
      .find({
        email: email.toLowerCase(),
        status: OrgInvitationStatus.PENDING,
        expiresAt: { $gt: new Date() },
      })
      .populate('organizationId', 'name slug logo')
      .populate('roleId', 'name key')
      .exec();
  }

  async findPendingForUser(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user?.email) return [];

    const ownsOrg = await this.orgModel
      .findOne({ ownerId: new Types.ObjectId(userId), deletedAt: null })
      .exec();
    if (ownsOrg) return [];

    return this.findPendingByEmail(user.email);
  }

  async accept(token: string, userId: string) {
    const invitation = await this.invitationModel
      .findOne({ token, status: OrgInvitationStatus.PENDING })
      .exec();

    if (!invitation) {
      throw new NotFoundException('Lời mời không hợp lệ hoặc đã hết hạn');
    }
    if (invitation.expiresAt < new Date()) {
      invitation.status = OrgInvitationStatus.EXPIRED;
      await invitation.save();
      throw new BadRequestException('Lời mời đã hết hạn');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new BadRequestException(
        'Email tài khoản không khớp với lời mời',
      );
    }

    const membership = await this.membershipsService.createMembership({
      organizationId: invitation.organizationId.toString(),
      userId,
      roleId: invitation.roleId.toString(),
      invitedBy: invitation.invitedBy.toString(),
    });

    invitation.status = OrgInvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = new Types.ObjectId(userId);
    await invitation.save();

    const org = await this.orgModel.findById(invitation.organizationId).exec();
    await this.notificationsService.create({
      userId,
      organizationId: invitation.organizationId.toString(),
      type: 'org_invitation_accepted',
      title: 'Đã tham gia Organization',
      body: `Bạn đã tham gia ${org?.name ?? 'Organization'} thành công.`,
      payload: {
        organizationId: invitation.organizationId.toString(),
        href: `/dashboard/org/${invitation.organizationId.toString()}`,
      },
    });

    return membership;
  }

  async reject(token: string, userId: string) {
    const invitation = await this.invitationModel
      .findOne({ token, status: OrgInvitationStatus.PENDING })
      .exec();

    if (!invitation) {
      throw new NotFoundException('Lời mời không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new BadRequestException(
        'Email tài khoản không khớp với lời mời',
      );
    }

    invitation.status = OrgInvitationStatus.REVOKED;
    await invitation.save();

    return { rejected: true, token };
  }
}
