import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Listing, ListingDocument } from './schemas/listing.schema';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { QueryPublicListingDto } from './dto/query-public-listing.dto';
import { ListingStatus, ListingPackage } from '../../common/enums/listing.enums';
import { ListingContext } from '../../common/enums/organization.enums';
import { calcListingPrice } from '../../common/utils/listing-price.util';
import { PUBLISHED_LISTING_STATUSES } from '../../common/constants/listing-stats.constants';
import { DEMO_USER_ID } from '../../common/constants';
import { OrgMembershipsService } from '../org-memberships/org-memberships.service';

const PACKAGE_DURATION_DAYS: Record<string, number> = {
  standard: 30,
  vip: 60,
  diamond: 90,
};

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    private readonly orgMembershipsService: OrgMembershipsService,
  ) {}

  private resolveExpiry(startDate?: string, duration?: number, pkg?: string) {
    const start = startDate ? new Date(startDate) : new Date();
    const days = duration ?? PACKAGE_DURATION_DAYS[pkg ?? 'standard'] ?? 30;
    return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Tạo tin đăng.
   *
   * BẮT BUỘC `options.paid = true` — chỉ PaymentsService được gọi sau khi
   * thanh toán thành công. Chặn tạo tin trực tiếp qua HTTP (vd: Postman)
   * mà không qua cổng thanh toán.
   */
  create(dto: CreateListingDto, options: { paid?: boolean } = {}) {
    if (!options.paid) {
      throw new ForbiddenException(
        'Tin đăng chỉ được tạo sau khi thanh toán thành công',
      );
    }

    const owner = dto.owner ?? DEMO_USER_ID;
    return this.listingModel.create({
      ...dto,
      owner: new Types.ObjectId(owner),
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      expiresAt: this.resolveExpiry(dto.startDate, dto.duration, dto.package),
    });
  }

  /** Tin Organization — chờ Manager duyệt, không trừ ví ngay. */
  async createOrgPending(
    userId: string,
    organizationId: string,
    dto: CreateListingDto,
  ) {
    const postCost = calcListingPrice(dto.package, dto.duration ?? 7);
    return this.listingModel.create({
      ...dto,
      owner: new Types.ObjectId(userId),
      postedBy: new Types.ObjectId(userId),
      context: ListingContext.ORGANIZATION,
      organizationId: new Types.ObjectId(organizationId),
      status: ListingStatus.PENDING_MANAGER,
      postCost,
      startDate: undefined,
      expiresAt: undefined,
    });
  }

  private personalListingFilter(ownerId: Types.ObjectId) {
    return {
      owner: ownerId,
      context: { $ne: ListingContext.ORGANIZATION },
    };
  }

  findAll(query: QueryListingDto) {
    const filter: Record<string, unknown> = {
      ...this.personalListingFilter(
        new Types.ObjectId(query.owner ?? DEMO_USER_ID),
      ),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { detail: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.listingModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  /** Đếm số tin theo từng trạng thái (phục vụ tab quản lý tin). */
  async countByStatus(owner: string = DEMO_USER_ID) {
    const ownerId = new Types.ObjectId(owner);
    const rows = await this.listingModel
      .aggregate<{ _id: ListingStatus; count: number }>([
        { $match: this.personalListingFilter(ownerId) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    const counts: Record<string, number> = { all: 0 };
    for (const status of Object.values(ListingStatus)) {
      counts[status] = 0;
    }
    for (const row of rows) {
      counts[row._id] = row.count;
      counts.all += row.count;
    }
    return counts;
  }

  /** Tổng hợp số liệu tin đăng cho trang Tổng quan. */
  async getStats(owner: string = DEMO_USER_ID) {
    const ownerId = new Types.ObjectId(owner);
    const [agg] = await this.listingModel
      .aggregate<{
        totalViews: number;
        totalContacts: number;
      }>([
        { $match: this.personalListingFilter(ownerId) },
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$views' },
            totalContacts: { $sum: '$contacts' },
          },
        },
      ])
      .exec();

    const counts = await this.countByStatus(owner);

    return {
      activeListings: counts[ListingStatus.ACTIVE] ?? 0,
      pendingListings: counts[ListingStatus.PENDING] ?? 0,
      totalListings: counts.all ?? 0,
      totalViews: agg?.totalViews ?? 0,
      totalContacts: agg?.totalContacts ?? 0,
    };
  }

  /** Tin đăng gần đây (đang hiển thị + chờ duyệt). */
  getRecent(owner: string = DEMO_USER_ID, limit = 4) {
    return this.listingModel
      .find({
        ...this.personalListingFilter(new Types.ObjectId(owner)),
        status: { $in: [ListingStatus.ACTIVE, ListingStatus.PENDING] },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findOne(id: string) {
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
    return listing;
  }

  private publicListingFilter() {
    const now = new Date();
    return {
      status: { $in: PUBLISHED_LISTING_STATUSES },
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    };
  }

  private formatPublicAgent(listing: ListingDocument) {
    const contact =
      listing.postedBy && typeof listing.postedBy === 'object'
        ? listing.postedBy
        : listing.owner && typeof listing.owner === 'object'
          ? listing.owner
          : null;

    if (!contact || !('name' in contact)) {
      return null;
    }

    const user = contact as {
      _id: Types.ObjectId;
      name: string;
      phone?: string;
      avatar?: string;
      accountType?: string;
      createdAt?: Date;
      settings?: { showPhonePublic?: boolean };
    };

    const showPhone = user.settings?.showPhonePublic !== false;
    const phone = showPhone ? user.phone : undefined;

    return {
      id: user._id.toString(),
      name: user.name,
      phone,
      phoneMasked: phone ? this.maskPhone(phone) : undefined,
      avatar: user.avatar,
      accountType: user.accountType ?? 'individual',
      memberSince: user.createdAt,
    };
  }

  private maskPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return phone;
    const visible = digits.slice(0, 7);
    const formatted = visible.replace(/(\d{4})(\d{3})/, '$1 $2');
    return `${formatted} ***`;
  }

  private formatPublicListing(listing: ListingDocument) {
    const org =
      listing.organizationId && typeof listing.organizationId === 'object'
        ? {
            id: (listing.organizationId as { _id: Types.ObjectId })._id.toString(),
            name: (listing.organizationId as { name?: string }).name,
            slug: (listing.organizationId as { slug?: string }).slug,
          }
        : undefined;

    return {
      ...listing.toObject(),
      agent: this.formatPublicAgent(listing),
      organization: org,
    };
  }

  async findPublicListings(query: QueryPublicListingDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      ...this.publicListingFilter(),
    };

    if (query.purpose) filter.purpose = query.purpose;
    if (query.province) {
      filter.province = { $regex: query.province, $options: 'i' };
    }
    if (query.ward) {
      filter.ward = { $regex: query.ward, $options: 'i' };
    }
    if (query.propertyType) {
      filter.propertyType = query.propertyType;
    }
    if (query.minPrice != null || query.maxPrice != null) {
      const priceFilter: Record<string, number> = {};
      if (query.minPrice != null) priceFilter.$gte = query.minPrice;
      if (query.maxPrice != null) priceFilter.$lte = query.maxPrice;
      filter.price = priceFilter;
    }
    if (query.minArea != null || query.maxArea != null) {
      const areaFilter: Record<string, number> = {};
      if (query.minArea != null) areaFilter.$gte = query.minArea;
      if (query.maxArea != null) areaFilter.$lte = query.maxArea;
      filter.area = areaFilter;
    }
    if (query.verified === '1' || query.verified === 'true') {
      filter.package = { $in: [ListingPackage.VIP, ListingPackage.DIAMOND] };
    }
    if (query.company === '1' || query.company === 'true') {
      filter.context = ListingContext.ORGANIZATION;
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
        { detail: { $regex: query.search, $options: 'i' } },
        { ward: { $regex: query.search, $options: 'i' } },
        { province: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort({ package: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'name phone avatar accountType createdAt settings')
        .populate('postedBy', 'name phone avatar accountType createdAt settings')
        .populate('organizationId', 'name slug')
        .exec(),
      this.listingModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => this.formatPublicListing(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findPublicOne(id: string) {
    const listing = await this.listingModel
      .findOneAndUpdate(
        { _id: id, ...this.publicListingFilter() },
        { $inc: { views: 1 } },
        { new: true },
      )
      .populate('owner', 'name phone avatar accountType createdAt settings')
      .populate('postedBy', 'name phone avatar accountType createdAt settings')
      .populate('organizationId', 'name slug logo')
      .exec();

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng hoặc tin đã hết hạn');
    }

    return this.formatPublicListing(listing);
  }

  async findTopWardsByProvince(province: string, limit = 10) {
    if (!province?.trim()) return [];

    const rows = await this.listingModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            ...this.publicListingFilter(),
            province: { $regex: province.trim(), $options: 'i' },
            ward: { $exists: true, $nin: [null, ''] },
          },
        },
        { $group: { _id: '$ward', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .exec();

    return rows.map((row) => ({
      ward: row._id,
      count: row.count,
    }));
  }

  async findTopProvinces(purpose?: 'sale' | 'rent', limit = 10) {
    const filter: Record<string, unknown> = {
      ...this.publicListingFilter(),
      province: { $exists: true, $nin: [null, ''] },
    };

    if (purpose === 'sale' || purpose === 'rent') {
      filter.purpose = purpose;
    }

    const rows = await this.listingModel
      .aggregate<{ _id: string; count: number }>([
        { $match: filter },
        { $group: { _id: '$province', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .exec();

    return rows.map((row) => ({
      province: row._id,
      count: row.count,
    }));
  }

  async findRecommendedListings(
    province: string | undefined,
    excludeId: string,
    limit = 9,
  ) {
    const filter: Record<string, unknown> = {
      ...this.publicListingFilter(),
    };

    if (excludeId && Types.ObjectId.isValid(excludeId)) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }

    if (province?.trim()) {
      filter.province = { $regex: province.trim(), $options: 'i' };
    }

    const items = await this.listingModel
      .find(filter)
      .sort({ package: -1, createdAt: -1 })
      .limit(limit)
      .populate('owner', 'name phone avatar accountType createdAt settings')
      .populate('postedBy', 'name phone avatar accountType createdAt settings')
      .populate('organizationId', 'name slug')
      .exec();

    return items.map((item) => this.formatPublicListing(item));
  }

  async recordPublicContact(id: string) {
    const listing = await this.listingModel
      .findOneAndUpdate(
        { _id: id, ...this.publicListingFilter() },
        { $inc: { contacts: 1 } },
        { new: true },
      )
      .populate('owner', 'name phone avatar accountType createdAt settings')
      .populate('postedBy', 'name phone avatar accountType createdAt settings')
      .exec();

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }

    return {
      contacts: listing.contacts,
      agent: this.formatPublicAgent(listing),
    };
  }

  async update(id: string, dto: UpdateListingDto) {
    const listing = await this.listingModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
    return listing;
  }

  /**
   * Gia hạn tin sau thanh toán thành công.
   * Không được gọi trực tiếp từ HTTP client (tránh bỏ qua phí / duyệt).
   */
  async renew(
    id: string,
    options: { days: number; userId: string; paid?: boolean },
  ) {
    if (!options.paid) {
      throw new ForbiddenException(
        'Gia hạn tin chỉ được thực hiện sau khi thanh toán thành công',
      );
    }

    const listing = await this.findOne(id);

    const orgId = listing.organizationId?.toString();
    if (
      listing.context === ListingContext.ORGANIZATION &&
      orgId
    ) {
      await this.orgMembershipsService.assertOwnerOrManager(
        orgId,
        options.userId,
      );
    } else if (listing.owner.toString() !== options.userId) {
      throw new ForbiddenException('Bạn không có quyền gia hạn tin này');
    }

    const renewable: ListingStatus[] = [
      ListingStatus.ACTIVE,
      ListingStatus.PUBLISHED,
      ListingStatus.EXPIRED,
    ];

    if (!renewable.includes(listing.status)) {
      throw new BadRequestException(
        'Chỉ gia hạn được tin đang hiển thị hoặc đã hết hạn. Tin chờ duyệt / bị từ chối không thể gia hạn.',
      );
    }

    const days = Math.max(1, Math.floor(options.days) || 7);
    const now = new Date();
    const base =
      listing.expiresAt && listing.expiresAt > now
        ? listing.expiresAt
        : now;

    listing.expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    listing.duration = days;

    // Chỉ khôi phục hiển thị nếu tin đã hết hạn — giữ nguyên status nếu đang live
    if (listing.status === ListingStatus.EXPIRED) {
      listing.status =
        listing.context === ListingContext.ORGANIZATION
          ? ListingStatus.PUBLISHED
          : ListingStatus.ACTIVE;
    }

    await listing.save();
    return listing;
  }

  async remove(id: string) {
    const listing = await this.listingModel.findByIdAndDelete(id).exec();
    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
    return { deleted: true, id };
  }
}
