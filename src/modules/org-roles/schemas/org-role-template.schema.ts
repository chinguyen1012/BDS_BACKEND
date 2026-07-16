import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { OrgRoleKey } from '../../../common/enums/organization.enums';

export type OrgRoleTemplateDocument = HydratedDocument<OrgRoleTemplate>;

@Schema({ timestamps: true })
export class OrgRoleTemplate {
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null })
  organizationId?: Types.ObjectId | null;

  @Prop({ enum: OrgRoleKey, required: true })
  key: OrgRoleKey | string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ default: false })
  isDefault: boolean;
}

export const OrgRoleTemplateSchema =
  SchemaFactory.createForClass(OrgRoleTemplate);

OrgRoleTemplateSchema.index(
  { organizationId: 1, key: 1 },
  { unique: true, sparse: true },
);
