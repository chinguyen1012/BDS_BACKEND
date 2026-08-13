import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

@Schema({ timestamps: true })
export class Department {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  leaderId?: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

DepartmentSchema.index({ organizationId: 1, name: 1 });
