import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PlatformAdmin,
  PlatformAdminDocument,
} from './schemas/platform-admin.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Organization,
  OrganizationDocument,
} from '../organizations/schemas/organization.schema';
import { Listing, ListingDocument } from '../listings/schemas/listing.schema';
import {
  PlatformSetting,
  PlatformSettingDocument,
} from '../auction/schemas/platform-setting.schema';
import { ListingStatus } from '../../common/enums/listing.enums';
import { ListingContext } from '../../common/enums/organization.enums';
import { SystemRole } from '../../common/enums/user.enums';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  normalizePagination,
  paginatedResult,
} from '../../common/utils/pagination.util';

const PAGINATION_SETTINGS_KEY = 'pagination';

@Injectable()
export class PlatformAdminService implements OnModuleInit {
  constructor(
    @InjectModel(PlatformAdmin.name)
    private readonly adminModel: Model<PlatformAdminDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(PlatformSetting.name)
    private readonly settingModel: Model<PlatformSettingDocument>,
  ) {}

  /** Đồng bộ legacy platform_admins → user.systemRole */
  async onModuleInit() {
    const legacyAdmins = await this.adminModel
      .find({ isActive: true })
      .select('userId')
      .exec();
    if (!legacyAdmins.length) return;

    await this.userModel
      .updateMany(
        {
          _id: { $in: legacyAdmins.map((a) => a.userId) },
          systemRole: { $ne: SystemRole.SYSTEM_ADMIN },
        },
        { $set: { systemRole: SystemRole.SYSTEM_ADMIN } },
      )
      .exec();

    await this.ensurePaginationSettings();
  }

  private async ensurePaginationSettings() {
    const existing = await this.settingModel
      .findOne({ key: PAGINATION_SETTINGS_KEY })
      .exec();
    if (existing) return;
    await this.settingModel.create({
      key: PAGINATION_SETTINGS_KEY,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    });
  }

  async getPaginationSettings() {
    await this.ensurePaginationSettings();
    const doc = await this.settingModel
      .findOne({ key: PAGINATION_SETTINGS_KEY })
      .exec();
    return {
      pageSize: doc?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
    };
  }

  async updatePaginationSettings(pageSize: number) {
    const size = Number(pageSize);
    if (
      !Number.isFinite(size) ||
      size < MIN_PAGE_SIZE ||
      size > MAX_PAGE_SIZE
    ) {
      throw new BadRequestException(
        `Số bản ghi mỗi trang phải từ ${MIN_PAGE_SIZE} đến ${MAX_PAGE_SIZE}`,
      );
    }
    const safe = Math.floor(size);
    await this.ensurePaginationSettings();
    const doc = await this.settingModel
      .findOneAndUpdate(
        { key: PAGINATION_SETTINGS_KEY },
        { $set: { pagination: { pageSize: safe } } },
        { new: true },
      )
      .exec();
    return {
      pageSize: doc?.pagination?.pageSize ?? safe,
    };
  }

  async isSystemAdmin(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('systemRole')
      .exec();
    return user?.systemRole === SystemRole.SYSTEM_ADMIN;
  }

  async getProfile(userId: string) {
    const isAdmin = await this.isSystemAdmin(userId);
    return {
      isAdmin,
      systemRole: isAdmin ? SystemRole.SYSTEM_ADMIN : SystemRole.USER,
      permissions: isAdmin ? [PERMISSIONS.LISTING_APPROVE_PLATFORM] : [],
    };
  }

  async getOverview() {
    const [
      totalUsers,
      totalOrganizations,
      totalListings,
      statusAgg,
      pendingAdmin,
      pendingManager,
      orgWalletAgg,
      recentPending,
    ] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.orgModel.countDocuments({ deletedAt: null }).exec(),
      this.listingModel.countDocuments().exec(),
      this.listingModel
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
      this.listingModel
        .countDocuments({
          $or: [
            { status: ListingStatus.PENDING_ADMIN },
            {
              context: { $ne: ListingContext.ORGANIZATION },
              status: ListingStatus.PENDING,
            },
          ],
        })
        .exec(),
      this.listingModel
        .countDocuments({ status: ListingStatus.PENDING_MANAGER })
        .exec(),
      this.orgModel
        .aggregate<{ total: number }>([
          { $match: { deletedAt: null } },
          { $group: { _id: null, total: { $sum: '$walletBalance' } } },
        ])
        .exec(),
      this.listingModel
        .find({
          $or: [
            { status: ListingStatus.PENDING_ADMIN },
            {
              context: { $ne: ListingContext.ORGANIZATION },
              status: ListingStatus.PENDING,
            },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('postedBy', 'name email')
        .populate('owner', 'name email')
        .populate('organizationId', 'name slug')
        .exec(),
    ]);

    const listingsByStatus = Object.fromEntries(
      statusAgg.map((row) => [row._id, row.count]),
    );

    return {
      totals: {
        users: totalUsers,
        organizations: totalOrganizations,
        listings: totalListings,
      },
      pendingAdmin,
      pendingManager,
      orgWalletBalance: orgWalletAgg[0]?.total ?? 0,
      listingsByStatus,
      recentPendingAdmin: recentPending,
    };
  }

  async listListings(
    status?: ListingStatus,
    page?: number | string,
    limit?: number | string,
  ) {
    const settings = await this.getPaginationSettings();
    const { page: safePage, limit: safeLimit, skip } = normalizePagination(
      page,
      limit,
      settings.pageSize,
    );
    const filter = status ? { status: status as ListingStatus } : {};

    const [items, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('postedBy', 'name email')
        .populate('organizationId', 'name slug')
        .populate('owner', 'name email')
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    return paginatedResult(items, total, safePage, safeLimit);
  }
}
