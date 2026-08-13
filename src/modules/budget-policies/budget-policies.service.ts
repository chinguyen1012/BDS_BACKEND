import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  BudgetPolicy,
  BudgetPolicyDocument,
} from './schemas/budget-policy.schema';
import { BudgetScope } from '../../common/enums/organization.enums';
import { Listing, ListingDocument } from '../listings/schemas/listing.schema';
import { ListingPackage } from '../../common/enums/listing.enums';
import { BUDGET_RESERVED_LISTING_STATUSES } from '../../common/constants/listing-stats.constants';

@Injectable()
export class BudgetPoliciesService {
  constructor(
    @InjectModel(BudgetPolicy.name)
    private readonly policyModel: Model<BudgetPolicyDocument>,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
  ) {}

  upsertUserPolicy(
    organizationId: string,
    userId: string,
    limits: BudgetPolicy['limits'],
    updatedBy: string,
  ) {
    return this.policyModel
      .findOneAndUpdate(
        {
          organizationId: new Types.ObjectId(organizationId),
          scope: BudgetScope.USER,
          scopeId: new Types.ObjectId(userId),
        },
        {
          organizationId: new Types.ObjectId(organizationId),
          scope: BudgetScope.USER,
          scopeId: new Types.ObjectId(userId),
          limits,
          updatedBy: new Types.ObjectId(updatedBy),
          effectiveFrom: new Date(),
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  getUserPolicy(organizationId: string, userId: string) {
    return this.policyModel
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        scope: BudgetScope.USER,
        scopeId: new Types.ObjectId(userId),
      })
      .exec();
  }

  listByOrg(organizationId: string) {
    return this.policyModel
      .find({
        organizationId: new Types.ObjectId(organizationId),
        scope: BudgetScope.USER,
      })
      .exec();
  }

  async getMyBudgetUsage(organizationId: string, userId: string) {
    const policy = await this.getUserPolicy(organizationId, userId);
    const limits = policy?.limits;
    const hasPolicy = Boolean(
      limits &&
      (limits.dailyBudget > 0 ||
        limits.maxCostPerPost > 0 ||
        limits.dailyPostLimit > 0),
    );

    if (!hasPolicy || !limits) {
      return { hasPolicy: false as const };
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const orgId = new Types.ObjectId(organizationId);
    const uid = new Types.ObjectId(userId);

    const [dailySpend, dailyPostCount] = await Promise.all([
      this.sumSpend(orgId, uid, startOfDay),
      this.countPosts(orgId, uid, startOfDay),
    ]);

    return {
      hasPolicy: true as const,
      limits: {
        dailyBudget: limits.dailyBudget,
        maxCostPerPost: limits.maxCostPerPost,
        dailyPostLimit: limits.dailyPostLimit,
      },
      usage: { dailySpend, dailyPostCount },
    };
  }

  async assertCanPost(
    organizationId: string,
    userId: string,
    cost: number,
    pkg: ListingPackage | string,
  ) {
    const policy = await this.getUserPolicy(organizationId, userId);
    if (!policy?.limits) return;

    const limits = policy.limits;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    if (limits.maxCostPerPost > 0 && cost > limits.maxCostPerPost) {
      throw new BadRequestException('Vượt hạn mức chi phí mỗi tin');
    }

    const orgId = new Types.ObjectId(organizationId);
    const uid = new Types.ObjectId(userId);

    const [dailySpend, dailyCount] = await Promise.all([
      this.sumSpend(orgId, uid, startOfDay),
      this.countPosts(orgId, uid, startOfDay),
    ]);

    if (limits.dailyBudget > 0 && dailySpend + cost > limits.dailyBudget) {
      throw new BadRequestException('Vượt ngân sách ngày');
    }
    if (limits.dailyPostLimit > 0 && dailyCount >= limits.dailyPostLimit) {
      throw new BadRequestException('Vượt số tin đăng trong ngày');
    }
  }

  private async sumSpend(
    orgId: Types.ObjectId,
    userId: Types.ObjectId,
    since: Date,
  ) {
    const rows = await this.listingModel
      .aggregate<{ total: number }>([
        {
          $match: {
            organizationId: orgId,
            postedBy: userId,
            createdAt: { $gte: since },
            status: { $in: BUDGET_RESERVED_LISTING_STATUSES },
          },
        },
        { $group: { _id: null, total: { $sum: '$postCost' } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  private countPosts(
    orgId: Types.ObjectId,
    userId: Types.ObjectId,
    since: Date,
  ) {
    return this.listingModel.countDocuments({
      organizationId: orgId,
      postedBy: userId,
      createdAt: { $gte: since },
      status: { $in: BUDGET_RESERVED_LISTING_STATUSES },
    });
  }

  private countPackage(
    orgId: Types.ObjectId,
    userId: Types.ObjectId,
    since: Date,
    pkg: ListingPackage,
  ) {
    return this.listingModel.countDocuments({
      organizationId: orgId,
      postedBy: userId,
      package: pkg,
      createdAt: { $gte: since },
    });
  }
}
