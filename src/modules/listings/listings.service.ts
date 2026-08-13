import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
import {
  generateListingPublicCode,
  isListingPublicCode,
  normalizeListingPublicCode,
} from '../../common/utils/listing-code.util';
import { PUBLISHED_LISTING_STATUSES } from '../../common/constants/listing-stats.constants';
import { DEMO_USER_ID } from '../../common/constants';
import { OrgMembershipsService } from '../org-memberships/org-memberships.service';
import { AuctionService } from '../auction/auction.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import {
  normalizePagination,
  paginatedResult,
} from '../../common/utils/pagination.util';
import { FrontendRevalidateService } from '../../common/frontend-revalidate/frontend-revalidate.service';

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
    @Inject(forwardRef(() => AuctionService))
    private readonly auctionService: AuctionService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
    private readonly frontendRevalidate: FrontendRevalidateService,
  ) {}

  private async allocatePublicCode(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = generateListingPublicCode();
      const exists = await this.listingModel.exists({ publicCode: code });
      if (!exists) return code;
    }
    throw new BadRequestException('Không tạo được mã tin, thử lại');
  }

  /** Gán mã BDS-XXXXXX nếu tin cũ chưa có. */
  private async ensurePublicCode(
    listing: ListingDocument,
  ): Promise<ListingDocument> {
    if (listing.publicCode) return listing;
    listing.publicCode = await this.allocatePublicCode();
    await listing.save();
    return listing;
  }

  private async ensurePublicCodes(docs: ListingDocument[]) {
    await Promise.all(docs.map((doc) => this.ensurePublicCode(doc)));
  }

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
  create(
    dto: CreateListingDto,
    options: { paid?: boolean; postCost?: number } = {},
  ) {
    if (!options.paid) {
      throw new ForbiddenException(
        'Tin đăng chỉ được tạo sau khi thanh toán thành công',
      );
    }

    const owner = dto.owner ?? DEMO_USER_ID;
    const postCost =
      options.postCost ??
      calcListingPrice(dto.package, dto.duration ?? 7);
    const { projectId, ...rest } = dto;
    return this.createWithPublicCode({
      ...rest,
      owner: new Types.ObjectId(owner),
      ...(projectId && Types.ObjectId.isValid(projectId)
        ? { projectId: new Types.ObjectId(projectId) }
        : {}),
      postCost,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      expiresAt: this.resolveExpiry(dto.startDate, dto.duration, dto.package),
    });
  }

  /** Tin Organization — Staff chờ Manager; Owner bỏ qua Manager, chờ Admin nền tảng. */
  async createOrgPending(
    userId: string,
    organizationId: string,
    dto: CreateListingDto,
  ) {
    const postCost = calcListingPrice(dto.package, dto.duration ?? 7, 'business');
    const isOwner = await this.orgMembershipsService.isOrganizationOwner(
      organizationId,
      userId,
    );
    return this.createWithPublicCode({
      ...dto,
      owner: new Types.ObjectId(userId),
      postedBy: new Types.ObjectId(userId),
      context: ListingContext.ORGANIZATION,
      organizationId: new Types.ObjectId(organizationId),
      status: isOwner
        ? ListingStatus.PENDING_ADMIN
        : ListingStatus.PENDING_MANAGER,
      postCost,
      startDate: undefined,
      expiresAt: undefined,
    });
  }

  private async createWithPublicCode(
    payload: Record<string, unknown>,
  ): Promise<ListingDocument> {
    const publicCode = await this.allocatePublicCode();
    return this.listingModel.create({ ...payload, publicCode });
  }

  private personalListingFilter(ownerId: Types.ObjectId) {
    return {
      owner: ownerId,
      context: { $ne: ListingContext.ORGANIZATION },
    };
  }

  async findAll(query: QueryListingDto) {
    const filter: Record<string, unknown> = {
      ...this.personalListingFilter(
        new Types.ObjectId(query.owner ?? DEMO_USER_ID),
      ),
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const q = query.search.trim();
      const searchOr: Record<string, unknown>[] = [
        { title: { $regex: q, $options: 'i' } },
        { detail: { $regex: q, $options: 'i' } },
        { publicCode: { $regex: q, $options: 'i' } },
      ];
      if (isListingPublicCode(q)) {
        searchOr.push({ publicCode: normalizeListingPublicCode(q) });
      }
      filter.$or = searchOr;
    }

    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const [items, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    await this.ensurePublicCodes(items);
    return paginatedResult(items, total, page, limit);
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

  async findOneForOwner(id: string, userId: string) {
    const listing = await this.listingModel.findById(id).exec();
    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
    if (listing.owner.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem tin này');
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

    const obj = listing.toObject();
    return {
      ...obj,
      _id: listing._id.toString(),
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
    if (query.projectId?.trim()) {
      filter.projectId = new Types.ObjectId(query.projectId.trim());
    } else if (query.project?.trim()) {
      filter.project = { $regex: query.project.trim(), $options: 'i' };
    }
    if (query.search) {
      const q = query.search.trim();
      const searchOr: Record<string, unknown>[] = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { detail: { $regex: q, $options: 'i' } },
        { ward: { $regex: q, $options: 'i' } },
        { province: { $regex: q, $options: 'i' } },
        { project: { $regex: q, $options: 'i' } },
        { publicCode: { $regex: q, $options: 'i' } },
      ];
      if (isListingPublicCode(q)) {
        searchOr.unshift({ publicCode: normalizeListingPublicCode(q) });
      }
      // Giữ điều kiện hết hạn ($or expiresAt) + điều kiện search
      filter.$and = [{ $or: filter.$or as object[] }, { $or: searchOr }];
      delete filter.$or;
    }

    const [auctionRanks, rankedIds, total] = await Promise.all([
      this.auctionService.peekActiveListingRanks(),
      this.auctionService.peekRankedListingIds(),
      this.listingModel.countDocuments(filter),
    ]);

    const rankedObjectIds = rankedIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const rankedDocs =
      rankedObjectIds.length > 0
        ? await this.listingModel
            .find({ ...filter, _id: { $in: rankedObjectIds } })
            .populate(
              'owner',
              'name phone avatar accountType createdAt settings',
            )
            .populate(
              'postedBy',
              'name phone avatar accountType createdAt settings',
            )
            .populate('organizationId', 'name slug')
            .exec()
        : [];

    const byId = new Map(
      rankedDocs.map((item) => [String(item._id), item] as const),
    );
    const auctionFirst: ListingDocument[] = [];
    for (const id of rankedIds) {
      const item = byId.get(id);
      if (item) auctionFirst.push(item);
    }
    const auctionCount = auctionFirst.length;
    const rankedMatchedIds = auctionFirst.map((item) => item._id);
    const restFilter: Record<string, unknown> =
      rankedMatchedIds.length > 0
        ? { ...filter, _id: { $nin: rankedMatchedIds } }
        : filter;

    let pageItems: ListingDocument[] = [];
    if (skip < auctionCount) {
      pageItems = auctionFirst.slice(skip, skip + limit);
      const need = limit - pageItems.length;
      if (need > 0) {
        const rest = await this.findPublicPage(restFilter, 0, need);
        pageItems = [...pageItems, ...rest];
      }
    } else {
      pageItems = await this.findPublicPage(
        restFilter,
        skip - auctionCount,
        limit,
      );
    }

    await this.ensurePublicCodes(pageItems);

    return {
      items: pageItems.map((item) => {
        const formatted = this.formatPublicListing(item);
        const meta = auctionRanks.get(String(item._id));
        if (meta) {
          return {
            ...formatted,
            auctionRank: meta.auctionRank,
            dailyBidAmount: meta.dailyBidAmount,
          };
        }
        return formatted;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** diamond → vip → standard, rồi mới nhất. */
  private async findPublicPage(
    filter: Record<string, unknown>,
    skip: number,
    limit: number,
  ): Promise<ListingDocument[]> {
    const ownerPop = 'name phone avatar accountType createdAt settings';
    const orgPop = 'name slug';
    const rows = await this.listingModel
      .aggregate<{ _id: Types.ObjectId }>([
        { $match: filter },
        {
          $addFields: {
            _packageRank: {
              $switch: {
                branches: [
                  { case: { $eq: ['$package', ListingPackage.DIAMOND] }, then: 3 },
                  { case: { $eq: ['$package', ListingPackage.VIP] }, then: 2 },
                ],
                default: 1,
              },
            },
          },
        },
        { $sort: { _packageRank: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { _id: 1 } },
      ])
      .exec();

    if (!rows.length) return [];

    const ids = rows.map((r) => r._id);
    const docs = await this.listingModel
      .find({ _id: { $in: ids } })
      .populate('owner', ownerPop)
      .populate('postedBy', ownerPop)
      .populate('organizationId', orgPop)
      .exec();

    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const ordered: ListingDocument[] = [];
    for (const id of ids) {
      const doc = byId.get(String(id));
      if (doc) ordered.push(doc);
    }
    return ordered;
  }

  async findPublicOne(id: string) {
    if (!id || id === 'undefined' || id === 'null') {
      throw new NotFoundException(
        'Không tìm thấy tin đăng hoặc tin đã hết hạn',
      );
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const isCode = isListingPublicCode(id);
    if (!isObjectId && !isCode) {
      throw new NotFoundException(
        'Không tìm thấy tin đăng hoặc tin đã hết hạn',
      );
    }

    const filter: Record<string, unknown> = {
      ...this.publicListingFilter(),
      ...(isObjectId
        ? { _id: id }
        : { publicCode: normalizeListingPublicCode(id) }),
    };

    const listing = await this.listingModel
      .findOneAndUpdate(filter, { $inc: { views: 1 } }, { new: true })
      .populate('owner', 'name phone avatar accountType createdAt settings')
      .populate('postedBy', 'name phone avatar accountType createdAt settings')
      .populate('organizationId', 'name slug logo')
      .exec();

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng hoặc tin đã hết hạn');
    }

    await this.ensurePublicCode(listing);
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

    if (excludeId) {
      if (Types.ObjectId.isValid(excludeId) && excludeId.length === 24) {
        filter._id = { $ne: new Types.ObjectId(excludeId) };
      } else if (isListingPublicCode(excludeId)) {
        filter.publicCode = {
          $ne: normalizeListingPublicCode(excludeId),
        };
      }
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

    await this.ensurePublicCodes(items);
    return items.map((item) => this.formatPublicListing(item));
  }

  async recordPublicContact(id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }

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

    await this.ensurePublicCode(listing);
    void this.frontendRevalidate.revalidateListing(
      listing._id.toString(),
      listing.publicCode,
    );

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
    void this.frontendRevalidate.revalidateListing(id);
    return listing;
  }

  /**
   * Chủ tin sửa nội dung khi bị từ chối (không đổi status / gói / phí).
   */
  async updateByOwner(id: string, userId: string, dto: UpdateListingDto) {
    const listing = await this.findOne(id);
    if (listing.owner.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền sửa tin này');
    }
    if (listing.context === ListingContext.ORGANIZATION) {
      throw new BadRequestException(
        'Tin Organization không sửa qua luồng cá nhân',
      );
    }
    if (listing.status !== ListingStatus.REJECTED) {
      throw new BadRequestException(
        'Chỉ sửa được tin cá nhân đang bị từ chối để gửi duyệt lại',
      );
    }

    const {
      status: _status,
      owner: _owner,
      package: _package,
      duration: _duration,
      ...safe
    } = dto;

    Object.assign(listing, safe);
    await listing.save();
    return listing;
  }

  /**
   * Gửi lại tin cá nhân bị từ chối → pending.
   * Phí đã hoàn về ví lúc từ chối → trừ lại từ số dư khi gửi duyệt lại.
   */
  async resubmitByOwner(id: string, userId: string) {
    const listing = await this.findOne(id);
    if (listing.owner.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền gửi lại tin này');
    }
    if (listing.context === ListingContext.ORGANIZATION) {
      throw new BadRequestException(
        'Tin Organization không gửi duyệt lại qua luồng cá nhân',
      );
    }
    if (listing.status !== ListingStatus.REJECTED) {
      throw new BadRequestException('Chỉ gửi lại được tin đang bị từ chối');
    }

    const cost =
      listing.postCost != null
        ? listing.postCost
        : calcListingPrice(
            listing.package,
            listing.duration ?? 7,
            (await this.usersService.findOne(userId)).accountType,
          );

    if (cost > 0) {
      const user = await this.usersService.findOne(userId);
      if ((user.balance ?? 0) < cost) {
        throw new BadRequestException(
          `Số dư không đủ để gửi duyệt lại. Cần ${cost.toLocaleString('vi-VN')}đ (đã hoàn về ví lúc từ chối). Vui lòng nạp thêm.`,
        );
      }
      await this.transactionsService.spend(
        userId,
        cost,
        `Gửi duyệt lại tin: ${listing.title}`,
      );
      // Cho phép hoàn lại nếu bị từ chối lần nữa
      listing.refundedAmount = 0;
    }

    listing.status = ListingStatus.PENDING;
    listing.approvalHistory.push({
      step: 'owner',
      actorId: new Types.ObjectId(userId),
      action: 'resubmitted',
      note:
        cost > 0
          ? `Chủ tin gửi duyệt lại (đã trừ ${cost.toLocaleString('vi-VN')}đ từ ví)`
          : 'Chủ tin gửi duyệt lại',
      at: new Date(),
    });
    await listing.save();
    return listing;
  }

  /**
   * Gia hạn tin sau thanh toán thành công.
   * Không được gọi trực tiếp từ HTTP client (tránh bỏ qua phí / duyệt).
   */
  async renew(
    id: string,
    options: {
      days: number;
      userId: string;
      paid?: boolean;
      package?: string;
      postCost?: number;
      /** Gọi nội bộ sau khi Manager/Owner duyệt gia hạn Staff. */
      skipPermissionCheck?: boolean;
    },
  ) {
    if (!options.paid) {
      throw new ForbiddenException(
        'Gia hạn tin chỉ được thực hiện sau khi thanh toán thành công',
      );
    }

    const listing = await this.findOne(id);

    const orgId = listing.organizationId?.toString();
    if (!options.skipPermissionCheck) {
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

    const days = Math.max(1, Math.floor(options.days) || 5);
    const now = new Date();
    const base =
      listing.expiresAt && listing.expiresAt > now
        ? listing.expiresAt
        : now;

    listing.expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    listing.duration = days;
    if (options.package) {
      listing.package = options.package as never;
    }
    if (options.postCost != null) {
      listing.postCost = options.postCost;
    }

    // Chỉ khôi phục hiển thị nếu tin đã hết hạn — giữ nguyên status nếu đang live
    if (listing.status === ListingStatus.EXPIRED) {
      listing.status =
        listing.context === ListingContext.ORGANIZATION
          ? ListingStatus.PUBLISHED
          : ListingStatus.ACTIVE;
    }

    listing.pendingRenewal = undefined;
    await listing.save();
    void this.frontendRevalidate.revalidateListing(id);
    return listing;
  }

  /** Staff Organization gửi yêu cầu gia hạn — chờ Owner/Manager duyệt. */
  async requestOrgRenewal(
    userId: string,
    organizationId: string,
    listingId: string,
    options: { days: number; package: string; postCost: number },
  ) {
    const listing = await this.findOne(listingId);
    if (listing.context !== ListingContext.ORGANIZATION) {
      throw new BadRequestException('Tin không thuộc Organization');
    }
    if (listing.organizationId?.toString() !== organizationId) {
      throw new BadRequestException('Tin không thuộc Organization này');
    }

    const posterId = (listing.postedBy ?? listing.owner)?.toString();
    if (posterId !== userId) {
      throw new ForbiddenException(
        'Chỉ người đăng tin mới được gửi yêu cầu gia hạn',
      );
    }

    const renewable: ListingStatus[] = [
      ListingStatus.ACTIVE,
      ListingStatus.PUBLISHED,
      ListingStatus.EXPIRED,
    ];
    if (!renewable.includes(listing.status)) {
      throw new BadRequestException(
        'Chỉ gia hạn được tin đang hiển thị hoặc đã hết hạn',
      );
    }

    if (listing.pendingRenewal) {
      throw new BadRequestException('Tin đang có yêu cầu gia hạn chờ duyệt');
    }

    listing.pendingRenewal = {
      duration: options.days,
      package: options.package,
      postCost: options.postCost,
      requestedBy: new Types.ObjectId(userId),
      requestedAt: new Date(),
    };
    listing.approvalHistory.push({
      step: 'staff',
      actorId: new Types.ObjectId(userId),
      action: 'renewal_requested',
      note: `Yêu cầu gia hạn ${options.days} ngày · gói ${options.package} · ${options.postCost.toLocaleString('vi-VN')}đ`,
      at: new Date(),
    });
    await listing.save();
    return listing;
  }

  async remove(id: string) {
    const listing = await this.listingModel.findByIdAndDelete(id).exec();
    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
    void this.frontendRevalidate.revalidateListing(id);
    return { deleted: true, id };
  }

  async removeByOwner(id: string, userId: string) {
    const listing = await this.findOne(id);
    const orgId = listing.organizationId?.toString();

    if (listing.context === ListingContext.ORGANIZATION && orgId) {
      const posterId = (listing.postedBy ?? listing.owner)?.toString();
      const isPoster = posterId === userId;
      const isManager = await this.orgMembershipsService.isOwnerOrManager(
        orgId,
        userId,
      );
      if (!isPoster && !isManager) {
        throw new ForbiddenException('Bạn không có quyền xóa tin này');
      }
    } else if (listing.owner.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa tin này');
    }

    await listing.deleteOne();
    void this.frontendRevalidate.revalidateListing(id);
    return { deleted: true, id };
  }
}
