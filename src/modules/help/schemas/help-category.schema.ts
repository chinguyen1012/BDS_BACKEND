import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HelpCategoryDocument = HydratedDocument<HelpCategory>;

@Schema({ timestamps: true, collection: 'help_categories' })
export class HelpCategory {
  /** Mã dùng trên URL / lọc (vd: bat-dau) */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  blurb: string;

  @Prop({ trim: true, default: '#A86F44' })
  accent: string;

  @Prop({ default: 0, index: true })
  sortOrder: number;
}

export const HelpCategorySchema = SchemaFactory.createForClass(HelpCategory);
HelpCategorySchema.index({ key: 1 }, { unique: true });
HelpCategorySchema.index({ sortOrder: 1, title: 1 });
