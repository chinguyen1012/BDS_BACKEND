import {
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
import { ListingStatus } from '../../common/enums/listing.enums';
import { DEMO_USER_ID } from '../../common/constants';

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

  findAll(query: QueryListingDto) {
    const filter: Record<string, unknown> = {
      owner: new Types.ObjectId(query.owner ?? DEMO_USER_ID),
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
    const rows = await this.listingModel
      .aggregate<{ _id: ListingStatus; count: number }>([
        { $match: { owner: new Types.ObjectId(owner) } },
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
        { $match: { owner: ownerId } },
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
        owner: new Types.ObjectId(owner),
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

  async update(id: string, dto: UpdateListingDto) {
    const listing = await this.listingModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
    return listing;
  }

  /** Gia hạn/làm mới tin: đẩy ngày hết hạn ra thêm. */
  async renew(id: string, days = 30) {
    const listing = await this.findOne(id);
    const base =
      listing.expiresAt && listing.expiresAt > new Date()
        ? listing.expiresAt
        : new Date();
    listing.expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    listing.status = ListingStatus.ACTIVE;
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
