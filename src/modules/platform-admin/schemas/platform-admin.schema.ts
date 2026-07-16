import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PlatformAdminDocument = HydratedDocument<PlatformAdmin>;

@Schema({ timestamps: true })
export class PlatformAdmin {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [String], default: ['listing.approve.platform'] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const PlatformAdminSchema = SchemaFactory.createForClass(PlatformAdmin);
