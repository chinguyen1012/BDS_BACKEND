import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { OrgRoleKey } from '../../../common/enums/organization.enums';

export type ApprovalWorkflowDocument = HydratedDocument<ApprovalWorkflow>;

@Schema({ _id: false })
export class ApprovalStep {
  @Prop({ enum: OrgRoleKey, required: true })
  role: OrgRoleKey | string;

  @Prop({ default: true })
  required: boolean;
}

const ApprovalStepSchema = SchemaFactory.createForClass(ApprovalStep);

@Schema({ timestamps: true })
export class ApprovalWorkflow {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, unique: true })
  organizationId: Types.ObjectId;

  @Prop({ type: [ApprovalStepSchema], default: [] })
  steps: ApprovalStep[];

  @Prop({ default: true })
  requirePlatformAdmin: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const ApprovalWorkflowSchema =
  SchemaFactory.createForClass(ApprovalWorkflow);
