import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  log(data: {
    userId: string;
    organizationId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    ip?: string;
    userAgent?: string;
  }) {
    return this.auditModel.create({
      userId: new Types.ObjectId(data.userId),
      organizationId: data.organizationId
        ? new Types.ObjectId(data.organizationId)
        : undefined,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      oldValue: data.oldValue as Record<string, unknown> | undefined,
      newValue: data.newValue as Record<string, unknown> | undefined,
      ip: data.ip,
      userAgent: data.userAgent,
    });
  }

  findByOrg(organizationId: string, limit = 100) {
    return this.auditModel
      .find({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
