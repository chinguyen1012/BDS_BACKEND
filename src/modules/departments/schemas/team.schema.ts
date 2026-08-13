import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TeamDocument = HydratedDocument<Team>;

@Schema({ timestamps: true })
export class Team {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
  departmentId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  leaderId?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

TeamSchema.index({ departmentId: 1, name: 1 });
