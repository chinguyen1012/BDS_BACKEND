import { Injectable, OnModuleInit } from '@nestjs/common';
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
import { ListingStatus } from '../../common/enums/listing.enums';
import { SystemRole } from '../../common/enums/user.enums';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

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
  }

  async isSystemAdmin(userId: string) {
    const user = await this.userModel.findById(userId).select('systemRole').exec();
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
        .countDocuments({ status: ListingStatus.PENDING_ADMIN })
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
        .find({ status: ListingStatus.PENDING_ADMIN })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('postedBy', 'name email')
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

  listListings(status?: ListingStatus) {
    const filter = status ? { status: status as ListingStatus } : {};
    return this.listingModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('postedBy', 'name email')
      .populate('organizationId', 'name slug')
      .populate('owner', 'name email')
      .exec();
  }
}
