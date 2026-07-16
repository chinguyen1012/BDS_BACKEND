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

@Injectable()
export class ListingApprovalService {
  constructor(
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    private readonly budgetService: BudgetPoliciesService,
    private readonly walletService: OrgWalletService,
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

  listPendingForPlatform() {
    return this.listingModel
      .find({
        context: ListingContext.ORGANIZATION,
        status: ListingStatus.PENDING_ADMIN,
      })
      .sort({ createdAt: -1 })
      .populate('postedBy', 'name email')
      .populate('organizationId', 'name slug logo')
      .exec();
  }

  private async findOrgListing(listingId: string) {
    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Không tìm thấy tin đăng');
    if (listing.context !== ListingContext.ORGANIZATION) {
      throw new BadRequestException('Tin không thuộc Organization');
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

  async approveByManager(listingId: string, actorId: string, note?: string) {
    const listing = await this.findOrgListing(listingId);
    if (listing.status !== ListingStatus.PENDING_MANAGER) {
      throw new BadRequestException('Tin không ở trạng thái chờ Manager duyệt');
    }
    listing.status = ListingStatus.PENDING_ADMIN;
    this.pushHistory(listing, 'manager', actorId, 'approved', note);
    await listing.save();
    return listing;
  }

  async rejectByManager(listingId: string, actorId: string, note?: string) {
    const listing = await this.findOrgListing(listingId);
    if (listing.status !== ListingStatus.PENDING_MANAGER) {
      throw new BadRequestException('Tin không ở trạng thái chờ Manager duyệt');
    }
    listing.status = ListingStatus.REJECTED_BY_MANAGER;
    this.pushHistory(listing, 'manager', actorId, 'rejected', note);
    await listing.save();
    return listing;
  }

  async approveByPlatform(listingId: string, actorId: string, note?: string) {
    const listing = await this.findOrgListing(listingId);
    if (listing.status !== ListingStatus.PENDING_ADMIN) {
      throw new BadRequestException('Tin không ở trạng thái chờ Admin duyệt');
    }

    const cost =
      listing.postCost ||
      calcListingPrice(listing.package, listing.duration ?? 7);
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
    this.pushHistory(listing, 'platform_admin', actorId, 'approved', note);
    await listing.save();
    return listing;
  }

  async rejectByPlatform(listingId: string, actorId: string, note?: string) {
    const listing = await this.findOrgListing(listingId);
    if (listing.status !== ListingStatus.PENDING_ADMIN) {
      throw new BadRequestException('Tin không ở trạng thái chờ Admin duyệt');
    }
    listing.status = ListingStatus.REJECTED_BY_ADMIN;
    this.pushHistory(listing, 'platform_admin', actorId, 'rejected', note);
    await listing.save();
    return listing;
  }
}
