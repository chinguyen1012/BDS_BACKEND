import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  create(data: {
    userId: string;
    organizationId?: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }) {
    return this.notificationModel.create({
      userId: new Types.ObjectId(data.userId),
      organizationId: data.organizationId
        ? new Types.ObjectId(data.organizationId)
        : undefined,
      type: data.type,
      title: data.title,
      body: data.body,
      payload: data.payload,
    });
  }

  listForUser(userId: string, limit = 50) {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async markRead(userId: string, notificationId: string) {
    return this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationId,
          userId: new Types.ObjectId(userId),
        },
        { readAt: new Date() },
        { new: true },
      )
      .exec();
  }
}
