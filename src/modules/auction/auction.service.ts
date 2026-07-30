import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuctionBidStatus,
  AuctionFloorRange,
  CANCEL_FLOOR_PENALTY_RATIO,
  DEFAULT_AUCTION_FLOORS,
  DEFAULT_MAX_AUCTION_SLOTS,
  MINUTES_PER_DAY,
} from '../../common/enums/auction.enums';
import {
  ListingContext,
  OrgMembershipStatus,
  OrgRoleKey,
  OrgTransactionType,
} from '../../common/enums/organization.enums';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../common/enums/transaction.enums';
import { PUBLISHED_LISTING_STATUSES } from '../../common/constants/listing-stats.constants';
import { Listing, ListingDocument } from '../listings/schemas/listing.schema';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';
import {
  Organization,
  OrganizationDocument,
} from '../organizations/schemas/organization.schema';
import {
  OrgTransaction,
  OrgTransactionDocument,
} from '../org-wallet/schemas/org-transaction.schema';
import {
  OrgMembership,
  OrgMembershipDocument,
} from '../org-memberships/schemas/org-membership.schema';
import {
  OrgRoleTemplate,
  OrgRoleTemplateDocument,
} from '../org-roles/schemas/org-role-template.schema';
import { UsersService } from '../users/users.service';
import {
  PlaceAuctionBidDto,
  UpdateAuctionSettingsDto,
} from './dto/auction.dto';
import {
  ListingAuctionBid,
  ListingAuctionBidDocument,
} from './schemas/listing-auction-bid.schema';
import {
  PlatformSetting,
  PlatformSettingDocument,
} from './schemas/platform-setting.schema';

const SETTINGS_KEY = 'listingAuction';

@Injectable()
export class AuctionService implements OnModuleInit {
  private settleTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectModel(PlatformSetting.name)
    private readonly settingModel: Model<PlatformSettingDocument>,
    @InjectModel(ListingAuctionBid.name)
    private readonly bidModel: Model<ListingAuctionBidDocument>,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(OrgTransaction.name)
    private readonly orgTxModel: Model<OrgTransactionDocument>,
    @InjectModel(OrgMembership.name)
    private readonly membershipModel: Model<OrgMembershipDocument>,
    @InjectModel(OrgRoleTemplate.name)
    private readonly roleModel: Model<OrgRoleTemplateDocument>,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    const existing = await this.settingModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!existing) {
      await this.settingModel.create({
        key: SETTINGS_KEY,
        listingAuction: {
          enabled: true,
          maxAuctionSlots: DEFAULT_MAX_AUCTION_SLOTS,
          floors: DEFAULT_AUCTION_FLOORS,
        },
      });
    }

    // Settle ranked bids every 10 minutes
    this.settleTimer = setInterval(() => {
      void this.refreshRanksAndSettle().catch(() => undefined);
    }, 10 * 60 * 1000);
  }

  private async getSettingsDoc() {
    let doc = await this.settingModel.findOne({ key: SETTINGS_KEY }).exec();
    if (!doc) {
      doc = await this.settingModel.create({
        key: SETTINGS_KEY,
        listingAuction: {
          enabled: true,
          maxAuctionSlots: DEFAULT_MAX_AUCTION_SLOTS,
          floors: DEFAULT_AUCTION_FLOORS,
        },
      });
    }
    return doc;
  }

  async getAuctionSettings() {
    const doc = await this.getSettingsDoc();
    const cfg = doc.listingAuction;
    return {
      enabled: cfg?.enabled ?? true,
      maxAuctionSlots: cfg?.maxAuctionSlots ?? DEFAULT_MAX_AUCTION_SLOTS,
      floors: cfg?.floors?.length ? cfg.floors : DEFAULT_AUCTION_FLOORS,
    };
  }

  async updateAuctionSettings(dto: UpdateAuctionSettingsDto) {
    const doc = await this.getSettingsDoc();
    const current = doc.listingAuction ?? {
      enabled: true,
      maxAuctionSlots: DEFAULT_MAX_AUCTION_SLOTS,
      floors: DEFAULT_AUCTION_FLOORS,
    };

    if (dto.enabled !== undefined) current.enabled = dto.enabled;
    if (dto.maxAuctionSlots !== undefined) {
      current.maxAuctionSlots = dto.maxAuctionSlots;
    }
    if (dto.floors !== undefined) {
      for (const floor of dto.floors) {
        if (floor.from > floor.to) {
          throw new BadRequestException('Dải vị trí không hợp lệ');
        }
      }
      current.floors = dto.floors;
    }

    doc.listingAuction = current as PlatformSetting['listingAuction'];
    await doc.save();
    return this.getAuctionSettings();
  }

  floorForRank(floors: AuctionFloorRange[], rank: number): number {
    const hit = floors.find((f) => rank >= f.from && rank <= f.to);
    return hit?.dailyFloor ?? floors[floors.length - 1]?.dailyFloor ?? 0;
  }

  perMinuteRate(dailyBid: number) {
    return dailyBid / MINUTES_PER_DAY;
  }

  /** Owner / Manager mới được đẩy tin Organization (trừ ví org). */
  private async assertOrgAuctionManager(userId: string, organizationId: string) {
    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(organizationId),
        status: OrgMembershipStatus.ACTIVE,
        deletedAt: null,
      })
      .exec();
    if (!membership) {
      throw new ForbiddenException('Bạn không thuộc Organization này');
    }
    const role = await this.roleModel.findById(membership.roleId).exec();
    const key = role?.key;
    if (key !== OrgRoleKey.OWNER && key !== OrgRoleKey.MANAGER) {
      throw new ForbiddenException(
        'Chỉ Owner / Manager mới được đẩy tin Organization',
      );
    }
    return membership;
  }

  private async getOrgBalance(organizationId: string) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');
    return org.walletBalance;
  }

  private async adjustOrgBalance(
    organizationId: string,
    amount: number,
    meta: {
      type: OrgTransactionType;
      description: string;
      performedBy: string;
      listingId?: string;
    },
  ) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');

    const next = org.walletBalance + amount;
    if (next < 0) {
      throw new BadRequestException('Số dư ví Organization không đủ');
    }

    org.walletBalance = next;
    await org.save();

    await this.orgTxModel.create({
      organizationId: new Types.ObjectId(organizationId),
      type: meta.type,
      amount,
      balanceAfter: next,
      description: meta.description,
      performedBy: new Types.ObjectId(meta.performedBy),
      listingId: meta.listingId
        ? new Types.ObjectId(meta.listingId)
        : undefined,
      status: TransactionStatus.SUCCESS,
    });

    return next;
  }

  private async refundHold(
    bid: ListingAuctionBidDocument,
    refund: number,
    description: string,
  ) {
    const orgId = bid.organizationId ? String(bid.organizationId) : null;
    if (orgId) {
      await this.adjustOrgBalance(orgId, refund, {
        type: OrgTransactionType.REFUND,
        description,
        performedBy: String(bid.ownerId),
        listingId: String(bid.listingId),
      });
      return;
    }

    await this.usersService.adjustBalance(String(bid.ownerId), refund);
    await this.transactionModel.create({
      owner: bid.ownerId,
      type: TransactionType.REFUND,
      description,
      amount: refund,
      method: PaymentMethod.BALANCE,
      status: TransactionStatus.SUCCESS,
    });
  }

  /**
   * Gán rank 1..maxSlots: sort giá DESC, chỉ nhận slot nếu bid >= sàn slot đó.
   */
  assignRanks(
    bids: Array<{ _id: Types.ObjectId; dailyBidAmount: number }>,
    floors: AuctionFloorRange[],
    maxSlots: number,
  ): Map<string, number> {
    const sorted = [...bids].sort(
      (a, b) => b.dailyBidAmount - a.dailyBidAmount,
    );
    const ranks = new Map<string, number>();
    let slot = 1;
    for (const bid of sorted) {
      while (slot <= maxSlots) {
        const floor = this.floorForRank(floors, slot);
        if (bid.dailyBidAmount >= floor) {
          ranks.set(String(bid._id), slot);
          slot += 1;
          break;
        }
        slot += 1;
      }
      if (slot > maxSlots) break;
    }
    return ranks;
  }

  private async settleAccrual(
    bid: ListingAuctionBidDocument,
    now: Date,
    options: {
      finalize?: boolean;
      nextStatus?: AuctionBidStatus;
      /**
       * Hủy sớm: đảm bảo tổng đã trừ (charged) tối thiểu bằng mức này
       * (= 50% giá sàn vị trí). Phần đã dùng được trừ vào, tránh phạt chồng.
       */
      minChargedOnCancel?: number;
    } = {},
  ) {
    // Tiền đã trừ lúc ký quỹ — settle phút chỉ chuyển held → charged (không trừ ví lần 2).
    if (bid.rankedSinceAt && bid.lastSettledAt && bid.heldAmount > 0) {
      const elapsedMs = Math.max(
        0,
        now.getTime() - bid.lastSettledAt.getTime(),
      );
      const minutes = Math.floor(elapsedMs / 60_000);
      if (minutes > 0) {
        const charge = Math.min(
          bid.heldAmount,
          Math.round(minutes * this.perMinuteRate(bid.dailyBidAmount)),
        );
        if (charge > 0) {
          bid.heldAmount -= charge;
          bid.chargedAmount += charge;
        }
      }
    }

    bid.lastSettledAt = now;

    if (options.finalize) {
      if (bid.heldAmount > 0) {
        const remaining = bid.heldAmount;
        const minCharged = Math.max(0, Math.round(options.minChargedOnCancel ?? 0));
        const extraPenalty =
          minCharged > 0
            ? Math.min(remaining, Math.max(0, minCharged - bid.chargedAmount))
            : 0;
        const refund = remaining - extraPenalty;

        if (extraPenalty > 0) {
          bid.chargedAmount += extraPenalty;
        }

        bid.heldAmount = 0;

        if (refund > 0) {
          bid.refundedAmount += refund;
          await this.refundHold(
            bid,
            refund,
            extraPenalty > 0
              ? `Hoàn ký quỹ đấu giá (bù phạt hủy ${extraPenalty.toLocaleString('vi-VN')}đ để đủ 50% giá sàn vị trí)`
              : minCharged > 0
                ? 'Hoàn ký quỹ đấu giá (đã dùng ≥ 50% giá sàn — không phạt thêm)'
                : 'Hoàn ký quỹ đấu giá đẩy tin (phần chưa dùng)',
          );
        }
      }
      if (options.nextStatus) {
        bid.status = options.nextStatus;
      }
      bid.currentRank = null;
      bid.rankedSinceAt = null;
    }

    await bid.save();
    return bid;
  }

  async refreshRanksAndSettle() {
    const settings = await this.getAuctionSettings();
    const now = new Date();

    // Expire by endsAt
    const expired = await this.bidModel
      .find({
        status: AuctionBidStatus.ACTIVE,
        endsAt: { $lte: now },
      })
      .exec();
    for (const bid of expired) {
      await this.settleAccrual(bid, now, {
        finalize: true,
        nextStatus: AuctionBidStatus.EXPIRED,
      });
    }

    if (!settings.enabled) {
      return { ranks: new Map<string, number>(), listingRank: new Map<string, number>() };
    }

    const active = await this.bidModel
      .find({
        status: AuctionBidStatus.ACTIVE,
        endsAt: { $gt: now },
        heldAmount: { $gt: 0 },
      })
      .exec();

    const ranks = this.assignRanks(
      active.map((b) => ({ _id: b._id, dailyBidAmount: b.dailyBidAmount })),
      settings.floors,
      settings.maxAuctionSlots,
    );

    const listingRank = new Map<string, number>();

    for (const bid of active) {
      const id = String(bid._id);
      const rank = ranks.get(id) ?? null;
      const wasRanked = bid.currentRank != null && bid.rankedSinceAt != null;
      const isRanked = rank != null;

      if (wasRanked) {
        await this.settleAccrual(bid, now);
      }

      if (wasRanked && !isRanked) {
        // Reloaded after settleAccrual save
        const fresh = await this.bidModel.findById(bid._id).exec();
        if (fresh && fresh.status === AuctionBidStatus.ACTIVE) {
          await this.settleAccrual(fresh, now, {
            finalize: true,
            nextStatus: AuctionBidStatus.OUTBID,
          });
        }
        continue;
      }

      if (!wasRanked && isRanked) {
        bid.rankedSinceAt = now;
        bid.lastSettledAt = now;
        bid.currentRank = rank;
        await bid.save();
      } else if (isRanked) {
        bid.currentRank = rank;
        await bid.save();
      }

      if (isRanked && rank != null) {
        listingRank.set(String(bid.listingId), rank);
      }

      // Exhausted hold while ranked
      const check = await this.bidModel.findById(bid._id).exec();
      if (
        check &&
        check.status === AuctionBidStatus.ACTIVE &&
        check.heldAmount <= 0
      ) {
        check.status = AuctionBidStatus.EXPIRED;
        check.currentRank = null;
        check.rankedSinceAt = null;
        await check.save();
        listingRank.delete(String(check.listingId));
      }
    }

    return { ranks, listingRank };
  }

  /** listingId -> { rank, dailyBidAmount } — đọc nhanh, không settle (dùng cho public list). */
  async peekActiveListingRanks() {
    const now = new Date();
    const active = await this.bidModel
      .find({
        status: AuctionBidStatus.ACTIVE,
        endsAt: { $gt: now },
        currentRank: { $ne: null },
      })
      .select('listingId currentRank dailyBidAmount')
      .lean()
      .exec();

    const map = new Map<
      string,
      { auctionRank: number; dailyBidAmount: number }
    >();
    for (const row of active) {
      if (row.currentRank == null) continue;
      map.set(String(row.listingId), {
        auctionRank: row.currentRank,
        dailyBidAmount: row.dailyBidAmount,
      });
    }
    return map;
  }

  /** Ordered listing IDs in auction ranks 1..N — không settle. */
  async peekRankedListingIds(): Promise<string[]> {
    const now = new Date();
    const rows = await this.bidModel
      .find({
        status: AuctionBidStatus.ACTIVE,
        endsAt: { $gt: now },
        currentRank: { $ne: null },
      })
      .sort({ currentRank: 1 })
      .select('listingId currentRank')
      .lean()
      .exec();
    return rows.map((r) => String(r.listingId));
  }

  /** listingId -> { rank, dailyBidAmount } for public list enrichment */
  async getActiveListingRanks() {
    await this.refreshRanksAndSettle();
    return this.peekActiveListingRanks();
  }

  /** Ordered listing IDs in auction ranks 1..N */
  async getRankedListingIds(): Promise<string[]> {
    await this.refreshRanksAndSettle();
    return this.peekRankedListingIds();
  }

  async getBoard(viewerId?: string) {
    const settings = await this.getAuctionSettings();
    await this.refreshRanksAndSettle();
    const now = new Date();

    const active = await this.bidModel
      .find({
        status: AuctionBidStatus.ACTIVE,
        endsAt: { $gt: now },
        currentRank: { $ne: null },
      })
      .sort({ currentRank: 1 })
      .populate('listingId', 'title images package province ward price area')
      .lean()
      .exec();

    const byRank = new Map<number, (typeof active)[number]>();
    for (const bid of active) {
      if (bid.currentRank != null) byRank.set(bid.currentRank, bid);
    }

    const slots = Array.from(
      { length: settings.maxAuctionSlots },
      (_, i) => {
        const rank = i + 1;
        const bid = byRank.get(rank);
        const listing = bid?.listingId as
          | {
              _id?: Types.ObjectId;
              title?: string;
              images?: string[];
              package?: string;
            }
          | string
          | undefined;
        const listingObj =
          listing && typeof listing === 'object' ? listing : null;
        const isMine =
          Boolean(viewerId) &&
          bid &&
          String(bid.ownerId) === String(viewerId);

        return {
          rank,
          floor: this.floorForRank(settings.floors, rank),
          dailyBidAmount: bid?.dailyBidAmount ?? null,
          isMine: Boolean(isMine),
          listing: listingObj
            ? {
                id: String(listingObj._id),
                title: listingObj.title,
                image: listingObj.images?.[0],
                package: listingObj.package,
              }
            : null,
          endsAt: bid?.endsAt ?? null,
        };
      },
    );

    return { settings, slots };
  }

  async getMyBids(userId: string) {
    await this.refreshRanksAndSettle();
    return this.bidModel
      .find({ ownerId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('listingId', 'title images status package')
      .lean()
      .exec();
  }

  async getOrgBids(organizationId: string, userId: string) {
    await this.assertOrgAuctionManager(userId, organizationId);
    await this.refreshRanksAndSettle();
    return this.bidModel
      .find({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('listingId', 'title images status package')
      .lean()
      .exec();
  }

  async placeBid(userId: string, dto: PlaceAuctionBidDto) {
    const settings = await this.getAuctionSettings();
    if (!settings.enabled) {
      throw new BadRequestException('Đấu giá đẩy tin đang tắt');
    }
    if (!Types.ObjectId.isValid(dto.listingId)) {
      throw new BadRequestException('Tin đăng không hợp lệ');
    }

    const listing = await this.listingModel.findById(dto.listingId).exec();
    if (!listing) throw new NotFoundException('Không tìm thấy tin đăng');
    if (!PUBLISHED_LISTING_STATUSES.includes(listing.status as never)) {
      throw new BadRequestException('Chỉ đẩy được tin đang hiển thị');
    }

    const isOrgListing = listing.context === ListingContext.ORGANIZATION;
    const listingOrgId = listing.organizationId
      ? String(listing.organizationId)
      : null;

    if (isOrgListing) {
      if (!listingOrgId) {
        throw new BadRequestException('Tin Organization thiếu organizationId');
      }
      if (dto.organizationId && dto.organizationId !== listingOrgId) {
        throw new BadRequestException('Organization không khớp tin đăng');
      }
      await this.assertOrgAuctionManager(userId, listingOrgId);
    } else {
      if (String(listing.owner) !== userId) {
        throw new ForbiddenException('Bạn không sở hữu tin đăng này');
      }
      if (dto.organizationId) {
        throw new BadRequestException(
          'Tin cá nhân không dùng ví Organization',
        );
      }
    }

    const dailyBid = Math.round(dto.dailyBidAmount);
    const days = dto.durationDays;
    const minFloor = Math.min(...settings.floors.map((f) => f.dailyFloor));
    if (dailyBid < minFloor) {
      throw new BadRequestException(
        `Giá tối thiểu để tham gia đấu giá là ${minFloor.toLocaleString('vi-VN')}đ/ngày`,
      );
    }

    const now = new Date();
    if (listing.expiresAt) {
      const expiresAt = new Date(listing.expiresAt);
      if (expiresAt.getTime() <= now.getTime()) {
        throw new BadRequestException(
          'Tin đăng đã hết hạn. Hãy gia hạn tin trước khi đẩy tin.',
        );
      }
      const auctionEndsAt = new Date(
        now.getTime() + days * 24 * 60 * 60 * 1000,
      );
      if (auctionEndsAt.getTime() > expiresAt.getTime()) {
        const remainingMs = expiresAt.getTime() - now.getTime();
        const maxDays = Math.max(
          0,
          Math.floor(remainingMs / (24 * 60 * 60 * 1000)),
        );
        const expiresLabel = expiresAt.toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        throw new BadRequestException(
          maxDays > 0
            ? `Tin đăng hết hạn ${expiresLabel}. Chỉ còn tối đa ${maxDays} ngày để đẩy tin, không thể chọn ${days} ngày. Hãy gia hạn tin hoặc giảm số ngày.`
            : `Tin đăng hết hạn ${expiresLabel}. Thời gian còn lại dưới 1 ngày, không thể đẩy ${days} ngày. Hãy gia hạn tin trước.`,
        );
      }
    }

    // Preview rank with this bid among current actives (excluding same listing)
    await this.refreshRanksAndSettle();
    const others = await this.bidModel
      .find({
        status: AuctionBidStatus.ACTIVE,
        endsAt: { $gt: now },
        heldAmount: { $gt: 0 },
        listingId: { $ne: listing._id },
      })
      .select('_id dailyBidAmount')
      .lean()
      .exec();

    const fakeId = new Types.ObjectId();
    const preview = this.assignRanks(
      [
        ...others.map((b) => ({
          _id: b._id as Types.ObjectId,
          dailyBidAmount: b.dailyBidAmount,
        })),
        { _id: fakeId, dailyBidAmount: dailyBid },
      ],
      settings.floors,
      settings.maxAuctionSlots,
    );
    const projected = preview.get(String(fakeId));
    if (projected == null) {
      throw new BadRequestException(
        'Giá chưa đủ để vào top vị trí đấu giá. Hãy tăng giá/ngày.',
      );
    }
    const needFloor = this.floorForRank(settings.floors, projected);
    if (dailyBid < needFloor) {
      throw new BadRequestException(
        `Để đạt khoảng vị trí #${projected} cần tối thiểu ${needFloor.toLocaleString('vi-VN')}đ/ngày`,
      );
    }

    const hold = dailyBid * days;
    if (isOrgListing && listingOrgId) {
      const balance = await this.getOrgBalance(listingOrgId);
      if (balance < hold) {
        throw new BadRequestException(
          `Số dư ví Organization không đủ. Cần ký quỹ ${hold.toLocaleString('vi-VN')}đ`,
        );
      }
    } else {
      const balance = await this.usersService.getBalance(userId);
      if (balance.balance < hold) {
        throw new BadRequestException(
          `Số dư không đủ. Cần ký quỹ ${hold.toLocaleString('vi-VN')}đ`,
        );
      }
    }

    // Close existing active bid on same listing (hoàn đủ phần chưa dùng — không phạt)
    const existing = await this.bidModel
      .find({
        listingId: listing._id,
        status: AuctionBidStatus.ACTIVE,
      })
      .exec();
    for (const old of existing) {
      await this.settleAccrual(old, now, {
        finalize: true,
        nextStatus: AuctionBidStatus.CANCELLED,
      });
    }

    const holdDescription = `Ký quỹ đấu giá đẩy tin "${listing.title}" — ${dailyBid.toLocaleString('vi-VN')}đ/ngày × ${days} ngày`;

    if (isOrgListing && listingOrgId) {
      await this.adjustOrgBalance(listingOrgId, -hold, {
        type: OrgTransactionType.SPEND,
        description: holdDescription,
        performedBy: userId,
        listingId: String(listing._id),
      });
    } else {
      await this.usersService.adjustBalance(userId, -hold);
      await this.transactionModel.create({
        owner: new Types.ObjectId(userId),
        type: TransactionType.SPEND,
        description: holdDescription,
        amount: -hold,
        method: PaymentMethod.BALANCE,
        status: TransactionStatus.SUCCESS,
      });
    }

    const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const bid = await this.bidModel.create({
      listingId: listing._id,
      ownerId: new Types.ObjectId(userId),
      organizationId: isOrgListing
        ? new Types.ObjectId(listingOrgId!)
        : undefined,
      dailyBidAmount: dailyBid,
      durationDays: days,
      heldAmount: hold,
      chargedAmount: 0,
      refundedAmount: 0,
      rankedSinceAt: null,
      lastSettledAt: now,
      startsAt: now,
      endsAt,
      status: AuctionBidStatus.ACTIVE,
      currentRank: null,
    });

    await this.refreshRanksAndSettle();
    const refreshed = await this.bidModel.findById(bid._id).lean().exec();
    return refreshed;
  }

  async cancelBid(userId: string, bidId: string) {
    if (!Types.ObjectId.isValid(bidId)) {
      throw new NotFoundException('Không tìm thấy lệnh đấu giá');
    }
    const bid = await this.bidModel.findById(bidId).exec();
    if (!bid) throw new NotFoundException('Không tìm thấy lệnh đấu giá');
    if (bid.status !== AuctionBidStatus.ACTIVE) {
      throw new BadRequestException('Lệnh đấu giá không còn hiệu lực');
    }

    if (bid.organizationId) {
      await this.assertOrgAuctionManager(userId, String(bid.organizationId));
    } else if (String(bid.ownerId) !== userId) {
      throw new ForbiddenException('Không có quyền');
    }

    const settings = await this.getAuctionSettings();
    const rank = bid.currentRank;
    const floorDaily =
      rank != null
        ? this.floorForRank(settings.floors, rank)
        : Math.min(...settings.floors.map((f) => f.dailyFloor));
    // Tối thiểu giữ lại 50% giá sàn; phần đã dùng được trừ vào để tránh phạt chồng.
    const minChargedOnCancel = Math.round(
      floorDaily * CANCEL_FLOOR_PENALTY_RATIO,
    );

    await this.settleAccrual(bid, new Date(), {
      finalize: true,
      nextStatus: AuctionBidStatus.CANCELLED,
      minChargedOnCancel,
    });
    await this.refreshRanksAndSettle();
    return this.bidModel.findById(bidId).lean().exec();
  }
}
