import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BannerPlacement } from '../../common/enums/banner.enums';
import {
  CreateBannerDto,
  QueryAdminBannersDto,
  UpdateBannerDto,
} from './dto/banner.dto';
import { Banner, BannerDocument } from './schemas/banner.schema';

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
  ) {}

  async findAdmin(query: QueryAdminBannersDto) {
    const filter: Record<string, unknown> = {};
    if (query.placement) filter.placement = query.placement;
    if (query.active === 'true') filter.active = true;
    if (query.active === 'false') filter.active = false;

    const items = await this.bannerModel
      .find(filter)
      .sort({ placement: 1, order: 1, createdAt: -1 })
      .lean()
      .exec();

    return { items };
  }

  async findAdminOne(id: string) {
    const item = await this.bannerModel.findById(id).lean().exec();
    if (!item) throw new NotFoundException('Không tìm thấy banner');
    return item;
  }

  async findPublic(placement?: BannerPlacement) {
    const now = new Date();
    const filter: Record<string, unknown> = {
      active: true,
      $and: [
        {
          $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }],
        },
        {
          $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }],
        },
      ],
    };
    if (placement) filter.placement = placement;

    const items = await this.bannerModel
      .find(filter)
      .sort({ order: 1, createdAt: -1 })
      .select('title placement image link alt order')
      .lean()
      .exec();

    return { items };
  }

  async create(dto: CreateBannerDto) {
    const created = await this.bannerModel.create({
      title: dto.title.trim(),
      placement: dto.placement,
      image: dto.image.trim(),
      link: dto.link?.trim() || '',
      alt: dto.alt?.trim() || dto.title.trim(),
      active: dto.active ?? true,
      order: dto.order ?? 0,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateBannerDto) {
    const update: Record<string, unknown> = {};
    if (dto.title !== undefined) update.title = dto.title.trim();
    if (dto.placement !== undefined) update.placement = dto.placement;
    if (dto.image !== undefined) update.image = dto.image.trim();
    if (dto.link !== undefined) update.link = dto.link.trim();
    if (dto.alt !== undefined) update.alt = dto.alt.trim();
    if (dto.active !== undefined) update.active = dto.active;
    if (dto.order !== undefined) update.order = dto.order;
    if (dto.startsAt !== undefined) {
      update.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    }
    if (dto.endsAt !== undefined) {
      update.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    }

    const item = await this.bannerModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();
    if (!item) throw new NotFoundException('Không tìm thấy banner');
    return item;
  }

  async remove(id: string) {
    const res = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Không tìm thấy banner');
    return { ok: true };
  }
}
