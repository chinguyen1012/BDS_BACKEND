import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { OrgInvitationStatus } from '../../../common/enums/organization.enums';

export type OrgInvitationDocument = HydratedDocument<OrgInvitation>;

@Schema({ timestamps: true })
export class OrgInvitation {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'OrgRoleTemplate', required: true })
  roleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ enum: OrgInvitationStatus, default: OrgInvitationStatus.PENDING })
  status: OrgInvitationStatus;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedByUserId?: Types.ObjectId;
}

export const OrgInvitationSchema = SchemaFactory.createForClass(OrgInvitation);

OrgInvitationSchema.index({ organizationId: 1, email: 1, status: 1 });
OrgInvitationSchema.index({ token: 1 }, { unique: true });
