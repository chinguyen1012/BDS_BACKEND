import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationStatus, ListingContext, OrgMembershipStatus } from '../../common/enums/organization.enums';
import { OrgMembershipsService } from '../org-memberships/org-memberships.service';
import { uniqueSlug } from '../../common/utils/slug.util';
import {
  ApprovalWorkflow,
  ApprovalWorkflowDocument,
} from '../approval/schemas/approval-workflow.schema';
import { Listing, ListingDocument } from '../listings/schemas/listing.schema';
import { ListingStatus } from '../../common/enums/listing.enums';
import { PUBLISHED_LISTING_STATUSES } from '../../common/constants/listing-stats.constants';
import {
  OrgTransaction,
  OrgTransactionDocument,
} from '../org-wallet/schemas/org-transaction.schema';
import { OrgMembership, OrgMembershipDocument } from '../org-memberships/schemas/org-membership.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(ApprovalWorkflow.name)
    private readonly workflowModel: Model<ApprovalWorkflowDocument>,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(OrgTransaction.name)
    private readonly txModel: Model<OrgTransactionDocument>,
    @InjectModel(OrgMembership.name)
    private readonly membershipModel: Model<OrgMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly membershipsService: OrgMembershipsService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    if (user.accountType !== 'business') {
      throw new ForbiddenException(
        'Cần đăng ký gói Tài khoản Doanh nghiệp trước khi tạo Organization',
      );
    }

    const ownedCount = await this.orgModel.countDocuments({
      ownerId: new Types.ObjectId(userId),
      deletedAt: null,
    });
    if (ownedCount >= 1) {
      throw new ForbiddenException(
        'Gói Doanh nghiệp hiện tại chỉ hỗ trợ tạo 1 Organization',
      );
    }

    const slug =
      dto.slug ??
      (await uniqueSlug(dto.name, async (s) =>
        Boolean(await this.orgModel.exists({ slug: s })),
      ));

    const org = await this.orgModel.create({
      ...dto,
      slug,
      ownerId: new Types.ObjectId(userId),
      walletBalance: 0,
      status: OrganizationStatus.ACTIVE,
    });

    await this.membershipsService.createOwnerMembership(
      org._id.toString(),
      userId,
    );

    await this.workflowModel.create({
      organizationId: org._id,
      steps: [{ role: 'manager', required: true }],
      requirePlatformAdmin: true,
      isActive: true,
    });

    return org;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.membershipsService.findByUser(userId);
    return memberships.map((m) => m.organizationId);
  }

  async findOne(id: string) {
    const org = await this.orgModel
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.orgModel
      .findOneAndUpdate({ _id: id, deletedAt: null }, dto, { new: true })
      .exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');
    return org;
  }

  async softDelete(id: string, userId: string) {
    const org = await this.findOne(id);
    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException('Chỉ Owner mới được xóa Organization');
    }
    org.deletedAt = new Date();
    org.status = OrganizationStatus.ARCHIVED;
    await org.save();
    return { deleted: true, id };
  }

  async getDashboardOverview(organizationId: string) {
    const org = await this.findOne(organizationId);
    const orgOid = new Types.ObjectId(organizationId);

    const [memberCount, listingStats, pendingManager, pendingAdmin, recentTx] =
      await Promise.all([
        this.membershipModel.countDocuments({
          organizationId: orgOid,
          deletedAt: null,
          status: OrgMembershipStatus.ACTIVE,
        }),
        this.listingModel.aggregate([
          {
            $match: {
              organizationId: orgOid,
              context: ListingContext.ORGANIZATION,
            },
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              spend: { $sum: '$postCost' },
            },
          },
        ]),
        this.listingModel.countDocuments({
          organizationId: orgOid,
          status: ListingStatus.PENDING_MANAGER,
        }),
        this.listingModel.countDocuments({
          organizationId: orgOid,
          status: ListingStatus.PENDING_ADMIN,
        }),
        this.txModel
          .find({ organizationId: orgOid })
          .sort({ createdAt: -1 })
          .limit(10)
          .exec(),
      ]);

    const byStatus: Record<string, number> = {};
    let totalSpend = 0;
    for (const row of listingStats) {
      byStatus[row._id] = row.count;
      if (
        row._id === ListingStatus.PUBLISHED ||
        row._id === ListingStatus.ACTIVE
      ) {
        totalSpend += row.spend ?? 0;
      }
    }

    return {
      organization: {
        id: org._id,
        name: org.name,
        walletBalance: org.walletBalance,
      },
      members: memberCount,
      listings: byStatus,
      pendingManager,
      pendingAdmin,
      totalSpend,
      recentTransactions: recentTx,
    };
  }

  async getAnalyticsReport(
    organizationId: string,
    period: 'day' | 'month' | 'year' = 'month',
  ) {
    const orgOid = new Types.ObjectId(organizationId);
    const now = new Date();
    let since: Date;
    if (period === 'day') {
      since = new Date(now);
      since.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      since = new Date(now.getFullYear(), 0, 1);
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [stats] = await this.listingModel
      .aggregate<{ posts: number; spend: number }>([
        {
          $match: {
            organizationId: orgOid,
            context: ListingContext.ORGANIZATION,
            status: { $in: PUBLISHED_LISTING_STATUSES },
          },
        },
        {
          $addFields: {
            effectiveDate: { $ifNull: ['$startDate', '$createdAt'] },
          },
        },
        { $match: { effectiveDate: { $gte: since } } },
        {
          $group: {
            _id: null,
            posts: { $sum: 1 },
            spend: { $sum: { $ifNull: ['$postCost', 0] } },
          },
        },
      ])
      .exec();

    return {
      period,
      since,
      posts: stats?.posts ?? 0,
      spend: stats?.spend ?? 0,
    };
  }

  private periodSince(period: 'day' | 'month' | 'year') {
    const now = new Date();
    if (period === 'day') {
      const since = new Date(now);
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      return { since, dateFormat: '%Y-%m-%d' as const };
    }
    if (period === 'year') {
      return {
        since: new Date(now.getFullYear(), 0, 1),
        dateFormat: '%Y-%m' as const,
      };
    }
    return {
      since: new Date(now.getFullYear(), now.getMonth(), 1),
      dateFormat: '%Y-%m-%d' as const,
    };
  }

  async getAnalyticsChart(
    organizationId: string,
    period: 'day' | 'month' | 'year' = 'month',
  ) {
    const orgOid = new Types.ObjectId(organizationId);
    const { since, dateFormat } = this.periodSince(period);

    const postRows = await this.listingModel
      .aggregate<{ _id: string; posts: number; spend: number }>([
        {
          $match: {
            organizationId: orgOid,
            context: ListingContext.ORGANIZATION,
            status: { $in: PUBLISHED_LISTING_STATUSES },
          },
        },
        {
          $addFields: {
            effectiveDate: { $ifNull: ['$startDate', '$createdAt'] },
          },
        },
        { $match: { effectiveDate: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: '$effectiveDate' },
            },
            posts: { $sum: 1 },
            spend: { $sum: { $ifNull: ['$postCost', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    return {
      period,
      points: postRows.map((row) => ({
        label: row._id,
        posts: row.posts,
        spend: row.spend,
      })),
    };
  }

  async getMemberAnalytics(
    organizationId: string,
    period: 'day' | 'month' | 'year' = 'month',
  ) {
    const orgOid = new Types.ObjectId(organizationId);
    const { since } = this.periodSince(period);

    const rows = await this.listingModel
      .aggregate<{
        _id: Types.ObjectId;
        posts: number;
        spend: number;
        name?: string;
        email?: string;
      }>([
        {
          $match: {
            organizationId: orgOid,
            context: ListingContext.ORGANIZATION,
            status: { $in: PUBLISHED_LISTING_STATUSES },
            postedBy: { $exists: true },
          },
        },
        {
          $addFields: {
            effectiveDate: { $ifNull: ['$startDate', '$createdAt'] },
          },
        },
        { $match: { effectiveDate: { $gte: since } } },
        {
          $group: {
            _id: '$postedBy',
            posts: { $sum: 1 },
            spend: { $sum: { $ifNull: ['$postCost', 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            posts: 1,
            spend: 1,
            name: '$user.name',
            email: '$user.email',
          },
        },
      ])
      .exec();

    return rows.map((r) => ({
      userId: r._id.toString(),
      name: r.name ?? '—',
      email: r.email ?? '',
      posts: r.posts,
      spend: r.spend,
    }));
  }

  listOrgListings(
    organizationId: string,
    filters?: { status?: string; postedBy?: string; pendingOnly?: boolean },
  ) {
    const query: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      context: ListingContext.ORGANIZATION,
    };
    if (filters?.status) {
      query.status = filters.status;
    } else if (filters?.pendingOnly) {
      query.status = ListingStatus.PENDING_MANAGER;
    }
    if (filters?.postedBy) {
      query.postedBy = new Types.ObjectId(filters.postedBy);
    }
    return this.listingModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('postedBy', 'name email')
      .exec();
  }
}
