import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Listing, ListingDocument } from '../listings/schemas/listing.schema';
import { ListingStatus } from '../../common/enums/listing.enums';
import { ListingContext } from '../../common/enums/organization.enums';
import { BudgetPoliciesService } from '../budget-policies/budget-policies.service';
import { OrgWalletService } from '../org-wallet/org-wallet.service';
import { OrgTransactionType } from '../../common/enums/organization.enums';
import { calcListingPrice } from '../../common/utils/listing-price.util';
import { TransactionsService } from '../transactions/transactions.service';
import {
  normalizePagination,
  paginatedResult,
} from '../../common/utils/pagination.util';
import { FrontendRevalidateService } from '../../common/frontend-revalidate/frontend-revalidate.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory } from '../../common/enums/notification.enums';

@Injectable()
export class ListingApprovalService {
  constructor(
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    private readonly budgetService: BudgetPoliciesService,
    private readonly walletService: OrgWalletService,
    private readonly transactionsService: TransactionsService,
    private readonly frontendRevalidate: FrontendRevalidateService,
    private readonly notificationsService: NotificationsService,
  ) {}

  listPendingForManager(organizationId: string) {
    return this.listingModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        context: ListingContext.ORGANIZATION,
        status: ListingStatus.PENDING_MANAGER,
      })
      .sort({ createdAt: -1 })
      .populate('postedBy', 'name email')
      .exec();
  }

  async listPendingForPlatform(page?: number | string, limit?: number | string) {
    const filter = {
      $or: [
        {
          context: ListingContext.ORGANIZATION,
          status: ListingStatus.PENDING_ADMIN,
        },
        {
          context: { $ne: ListingContext.ORGANIZATION },
          status: ListingStatus.PENDING,
        },
      ],
    };
    const { page: safePage, limit: safeLimit, skip } = normalizePagination(
      page,
      limit,
    );

    const [items, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('postedBy', 'name email')
        .populate('owner', 'name email')
        .populate('organizationId', 'name slug logo')
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    return paginatedResult(items, total, safePage, safeLimit);
  }

  private async findOrgListing(listingId: string) {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Không tìm thấy tin đăng');
    if (listing.context !== ListingContext.ORGANIZATION) {
      throw new BadRequestException('Tin không thuộc Organization');
    }
    return listing;
  }

  /** Tin chờ Admin nền tảng: org `pending_admin` hoặc cá nhân `pending`. */
  private async findPlatformPendingListing(listingId: string) {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Không tìm thấy tin đăng');

    const isOrgPending =
      listing.context === ListingContext.ORGANIZATION &&
      listing.status === ListingStatus.PENDING_ADMIN;
    const isPersonalPending =
      listing.context !== ListingContext.ORGANIZATION &&
      listing.status === ListingStatus.PENDING;

    if (!isOrgPending && !isPersonalPending) {
      throw new BadRequestException('Tin không ở trạng thái chờ Admin duyệt');
    }
    return listing;
  }

  private pushHistory(
    listing: ListingDocument,
    step: string,
    actorId: string,
    action: string,
    note?: string,
  ) {
    listing.approvalHistory.push({
      step,
      actorId: new Types.ObjectId(actorId),
      action,
      note,
      at: new Date(),
    });
  }

  private requireNote(note?: string) {
    const trimmed = note?.trim();
    if (!trimmed) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }
    return trimmed;
  }

  private listingRecipientId(listing: ListingDocument) {
    return (listing.postedBy ?? listing.owner)?.toString();
  }

  private async notifyListingOwner(
    listing: ListingDocument,
    data: {
      type: string;
      title: string;
      body: string;
    },
  ) {
    const userId = this.listingRecipientId(listing);
    if (!userId) return;
    try {
      await this.notificationsService.create({
        userId,
        organizationId: listing.organizationId?.toString(),
        type: data.type,
        category: NotificationCategory.LISTING,
        title: data.title,
        body: data.body,
        payload: {
          listingId: listing._id.toString(),
          href: `/dashboard/listings`,
        },
      });
    } catch {
      /* không chặn luồng duyệt */
    }
  }

  async approveByManager(listingId: string, actorId: string, note?: string) {
    const listing = await this.findOrgListing(listingId);
    if (listing.status !== ListingStatus.PENDING_MANAGER) {
      throw new BadRequestException('Tin không ở trạng thái chờ Manager duyệt');
    }
    listing.status = ListingStatus.PENDING_ADMIN;
    this.pushHistory(listing, 'manager', actorId, 'approved', note);
    await listing.save();
    await this.notifyListingOwner(listing, {
      type: 'listing_approved',
      title: 'Tin đã được Manager duyệt',
      body: `"${listing.title}" đã chuyển sang chờ Admin nền tảng duyệt.`,
    });
    return listing;
  }

  async rejectByManager(listingId: string, actorId: string, note?: string) {
    const listing = await this.findOrgListing(listingId);
    if (listing.status !== ListingStatus.PENDING_MANAGER) {
      throw new BadRequestException('Tin không ở trạng thái chờ Manager duyệt');
    }
    const reason = this.requireNote(note);
    listing.status = ListingStatus.REJECTED_BY_MANAGER;
    this.pushHistory(listing, 'manager', actorId, 'rejected', reason);
    await listing.save();
    await this.notifyListingOwner(listing, {
      type: 'listing_rejected',
      title: 'Tin bị Manager từ chối',
      body: `"${listing.title}": ${reason}`,
    });
    return listing;
  }

  async approveByPlatform(listingId: string, actorId: string, note?: string) {
    const listing = await this.findPlatformPendingListing(listingId);

    if (listing.context === ListingContext.ORGANIZATION) {
      const cost =
        listing.postCost ||
        calcListingPrice(listing.package, listing.duration ?? 7, 'business');
      const orgId = listing.organizationId!.toString();

      await this.walletService.adjustBalance(orgId, -cost, {
        type: OrgTransactionType.SPEND,
        description: `Đăng tin: ${listing.title}`,
        performedBy: actorId,
        listingId: listing._id.toString(),
      });

      listing.status = ListingStatus.PUBLISHED;
      listing.startDate = new Date();
      const days = listing.duration ?? 30;
      listing.expiresAt = new Date(
        listing.startDate.getTime() + days * 24 * 60 * 60 * 1000,
      );
    } else {
      // Tin cá nhân đã thanh toán khi tạo — chỉ cần duyệt để hiển thị
      listing.status = ListingStatus.ACTIVE;
      if (!listing.startDate) listing.startDate = new Date();
      if (!listing.expiresAt) {
        const days = listing.duration ?? 30;
        listing.expiresAt = new Date(
          listing.startDate.getTime() + days * 24 * 60 * 60 * 1000,
        );
      }
    }

    this.pushHistory(listing, 'platform_admin', actorId, 'approved', note);
    await listing.save();
    void this.frontendRevalidate.revalidateListing(listingId);
    await this.notifyListingOwner(listing, {
      type: 'listing_approved',
      title: 'Tin đăng đã được duyệt',
      body: `"${listing.title}" đã được xuất bản trên DatViet Land.`,
    });
    return listing;
  }

  async rejectByPlatform(listingId: string, actorId: string, note?: string) {
    const listing = await this.findPlatformPendingListing(listingId);
    const reason = this.requireNote(note);

    if (listing.context === ListingContext.ORGANIZATION) {
      listing.status = ListingStatus.REJECTED_BY_ADMIN;
    } else {
      listing.status = ListingStatus.REJECTED;

      // Hoàn phí đăng tin về ví (1 lần). Gửi duyệt lại miễn phí.
      const alreadyRefunded = listing.refundedAmount ?? 0;
      // postCost có giá trị (kể cả 0) = đúng số đã trả; thiếu = tin cũ → ước từ gói
      const cost =
        listing.postCost != null
          ? listing.postCost
          : calcListingPrice(listing.package, listing.duration ?? 7, 'business');
      const refund = Math.max(0, cost - alreadyRefunded);

      if (refund > 0) {
        const ownerId = listing.owner.toString();
        await this.transactionsService.refund(
          ownerId,
          refund,
          `Hoàn phí đăng tin bị từ chối: ${listing.title}`,
        );
        listing.refundedAmount = alreadyRefunded + refund;
      }
    }

    this.pushHistory(listing, 'platform_admin', actorId, 'rejected', reason);
    await listing.save();
    void this.frontendRevalidate.revalidateListing(listingId);
    await this.notifyListingOwner(listing, {
      type: 'listing_rejected',
      title: 'Tin đăng bị từ chối',
      body: `"${listing.title}": ${reason}`,
    });
    return listing;
  }

  async approveRenewalByManager(
    listingId: string,
    actorId: string,
    note?: string,
  ) {
    const listing = await this.findOrgListing(listingId);
    const pending = listing.pendingRenewal;
    if (!pending) {
      throw new BadRequestException('Tin không có yêu cầu gia hạn chờ duyệt');
    }

    const orgId = listing.organizationId!.toString();
    const cost = pending.postCost ?? 0;

    if (cost > 0) {
      await this.walletService.adjustBalance(orgId, -cost, {
        type: OrgTransactionType.SPEND,
        description: `Gia hạn tin: ${listing.title}`,
        performedBy: actorId,
        listingId: listing._id.toString(),
      });
    }

    const days = Math.max(1, pending.duration || 5);
    const now = new Date();
    const base =
      listing.expiresAt && listing.expiresAt > now ? listing.expiresAt : now;
    listing.expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    listing.duration = days;
    listing.package = pending.package as never;
    listing.postCost = cost;

    if (listing.status === ListingStatus.EXPIRED) {
      listing.status = ListingStatus.PUBLISHED;
    }

    listing.pendingRenewal = undefined;
    this.pushHistory(
      listing,
      'manager',
      actorId,
      'renewal_approved',
      note ??
        `Duyệt gia hạn ${days} ngày · ${cost.toLocaleString('vi-VN')}đ`,
    );
    await listing.save();
    void this.frontendRevalidate.revalidateListing(listingId);
    await this.notifyListingOwner(listing, {
      type: 'listing_renewal_approved',
      title: 'Yêu cầu gia hạn đã được duyệt',
      body: `"${listing.title}" đã được gia hạn thêm ${days} ngày.`,
    });
    return listing;
  }

  async rejectRenewalByManager(
    listingId: string,
    actorId: string,
    note?: string,
  ) {
    const listing = await this.findOrgListing(listingId);
    if (!listing.pendingRenewal) {
      throw new BadRequestException('Tin không có yêu cầu gia hạn chờ duyệt');
    }

    const reason =
      note?.trim() ||
      'Manager/Owner từ chối yêu cầu gia hạn';
    listing.pendingRenewal = undefined;
    this.pushHistory(listing, 'manager', actorId, 'renewal_rejected', reason);
    await listing.save();
    await this.notifyListingOwner(listing, {
      type: 'listing_renewal_rejected',
      title: 'Yêu cầu gia hạn bị từ chối',
      body: `"${listing.title}": ${reason}`,
    });
    return listing;
  }
}
