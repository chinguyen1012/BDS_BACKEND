import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { BudgetScope } from '../../../common/enums/organization.enums';

export type BudgetPolicyDocument = HydratedDocument<BudgetPolicy>;

@Schema({ _id: false })
export class BudgetLimits {
  @Prop({ default: 0 })
  dailyBudget: number;

  @Prop({ default: 0 })
  monthlyBudget: number;

  @Prop({ default: 0 })
  maxCostPerPost: number;

  @Prop({ default: 0 })
  dailyPostLimit: number;

  @Prop({ default: 0 })
  monthlyPostLimit: number;

  @Prop({ default: 0 })
  vipLimit: number;

  @Prop({ default: 0 })
  diamondLimit: number;
}

const BudgetLimitsSchema = SchemaFactory.createForClass(BudgetLimits);

@Schema({ timestamps: true })
export class BudgetPolicy {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ enum: BudgetScope, default: BudgetScope.USER })
  scope: BudgetScope;

  @Prop({ type: Types.ObjectId })
  scopeId?: Types.ObjectId;

  @Prop({ type: BudgetLimitsSchema, default: () => ({}) })
  limits: BudgetLimits;

  @Prop({ default: () => new Date() })
  effectiveFrom: Date;

  @Prop()
  effectiveTo?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const BudgetPolicySchema = SchemaFactory.createForClass(BudgetPolicy);

BudgetPolicySchema.index({ organizationId: 1, scope: 1, scopeId: 1 });
