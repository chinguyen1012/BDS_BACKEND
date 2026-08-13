import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  NotificationCategory,
  resolveNotificationCategory,
} from '../../common/enums/notification.enums';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

export type CreateNotificationInput = {
  userId: string;
  organizationId?: string;
  type: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  category?: NotificationCategory;
};

function categoryTypeRegex(cat: NotificationCategory): string {
  switch (cat) {
    case NotificationCategory.LISTING:
      return '^(listing|auction)';
    case NotificationCategory.FINANCE:
      return '^(finance|payment|topup|wallet|refund|transaction)';
    case NotificationCategory.PROMO:
      return '^(promo|promotion|membership|voucher)';
    case NotificationCategory.ACCOUNT:
      return '^(account|org_|security)';
    default:
      return '^$'; // other: chỉ doc có category=other hoặc không khớp prefix ở trên
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  create(data: CreateNotificationInput) {
    const category =
      data.category ?? resolveNotificationCategory(data.type);
    return this.notificationModel.create({
      userId: new Types.ObjectId(data.userId),
      organizationId: data.organizationId
        ? new Types.ObjectId(data.organizationId)
        : undefined,
      type: data.type,
      category,
      title: data.title,
      body: data.body,
      payload: data.payload ?? {},
    });
  }

  private format(doc: NotificationDocument | Record<string, unknown>) {
    const o =
      typeof (doc as NotificationDocument).toObject === 'function'
        ? (doc as NotificationDocument).toObject()
        : { ...doc };
    const type = String((o as { type?: string }).type || '');
    const category =
      (o as { category?: NotificationCategory }).category ||
      resolveNotificationCategory(type);
    return { ...o, category };
  }

  async listForUser(
    userId: string,
    opts: {
      category?: string;
      unreadOnly?: boolean;
      limit?: number;
      page?: number;
    } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const page = Math.max(opts.page ?? 1, 1);
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (opts.category && opts.category !== 'all') {
      const cat = opts.category as NotificationCategory;
      if (Object.values(NotificationCategory).includes(cat)) {
        // Doc mới có category; doc cũ thiếu field → khớp theo type map
        filter.$or = [
          { category: cat },
          {
            $and: [
              {
                $or: [
                  { category: { $exists: false } },
                  { category: null },
                ],
              },
              // Lọc thô theo prefix type; format() sẽ chuẩn hoá khi trả về
              {
                type: {
                  $regex: categoryTypeRegex(cat),
                  $options: 'i',
                },
              },
            ],
          },
        ];
      }
    }
    if (opts.unreadOnly) {
      const unreadClause = {
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or as unknown[] }, unreadClause];
        delete filter.$or;
      } else {
        Object.assign(filter, unreadClause);
      }
    }

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);

    // Backfill category for legacy docs missing the field
    const formatted = items.map((item) => this.format(item));

    return {
      items: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async unreadCount(userId: string, category?: string) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    };
    if (category && category !== 'all') {
      const cat = category as NotificationCategory;
      if (Object.values(NotificationCategory).includes(cat)) {
        filter.category = cat;
      }
    }
    const count = await this.notificationModel.countDocuments(filter).exec();
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    const doc = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationId,
          userId: new Types.ObjectId(userId),
        },
        { readAt: new Date() },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy thông báo');
    return this.format(doc);
  }

  async markAllRead(userId: string, category?: string) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    };
    if (category && category !== 'all') {
      const cat = category as NotificationCategory;
      if (Object.values(NotificationCategory).includes(cat)) {
        filter.category = cat;
      }
    }
    const result = await this.notificationModel
      .updateMany(filter, { $set: { readAt: new Date() } })
      .exec();
    return { updated: result.modifiedCount };
  }

  async remove(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    const doc = await this.notificationModel
      .findOneAndDelete({
        _id: notificationId,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy thông báo');
    return { deleted: true, id: notificationId };
  }
}
