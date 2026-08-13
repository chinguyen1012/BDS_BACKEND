import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { OrganizationStatus } from '../../../common/enums/organization.enums';

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ _id: false })
export class OrganizationSettings {
  @Prop({ default: true })
  requirePlatformAdmin: boolean;

  @Prop({ default: true })
  requireManagerApproval: boolean;
}

const OrganizationSettingsSchema =
  SchemaFactory.createForClass(OrganizationSettings);

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop()
  logo?: string;

  @Prop()
  cover?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  taxCode?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ enum: OrganizationStatus, default: OrganizationStatus.ACTIVE })
  status: OrganizationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  walletBalance: number;

  @Prop({ type: OrganizationSettingsSchema, default: () => ({}) })
  settings: OrganizationSettings;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ ownerId: 1, status: 1 });
OrganizationSchema.index({ deletedAt: 1 });
