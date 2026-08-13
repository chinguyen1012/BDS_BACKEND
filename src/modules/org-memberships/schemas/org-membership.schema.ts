import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { OrgMembershipStatus } from '../../../common/enums/organization.enums';

export type OrgMembershipDocument = HydratedDocument<OrgMembership>;

@Schema({ timestamps: true })
export class OrgMembership {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'OrgRoleTemplate', required: true })
  roleId: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ enum: OrgMembershipStatus, default: OrgMembershipStatus.ACTIVE })
  status: OrgMembershipStatus;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  departmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team' })
  teamId?: Types.ObjectId;

  @Prop({ default: () => new Date() })
  joinedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const OrgMembershipSchema = SchemaFactory.createForClass(OrgMembership);

OrgMembershipSchema.index(
  { userId: 1, organizationId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
OrgMembershipSchema.index({ organizationId: 1, status: 1 });
