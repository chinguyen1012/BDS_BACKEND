import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { HelpStatus } from '../../../common/enums/help.enums';

export type HelpArticleDocument = HydratedDocument<HelpArticle>;

@Schema({ timestamps: true, collection: 'help_articles' })
export class HelpArticle {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  summary: string;

  @Prop({ required: true, trim: true, index: true })
  categoryId: string;

  @Prop({ required: true, trim: true })
  categoryTitle: string;

  @Prop({ trim: true, default: '' })
  categoryBlurb: string;

  @Prop({ trim: true, default: '#A86F44' })
  categoryAccent: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Structured content blocks (p, h2, tip, steps, faq, …) — dùng mục lục / fallback */
  @Prop({ type: [Object], default: [] })
  blocks: Record<string, unknown>[];

  /** Rich HTML từ text editor (ưu tiên hiển thị công khai) */
  @Prop({ type: String, default: '' })
  contentHtml: string;

  @Prop({
    enum: HelpStatus,
    default: HelpStatus.DRAFT,
    index: true,
  })
  status: HelpStatus;

  @Prop({ default: 0, index: true })
  sortOrder: number;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  updatedBy?: Types.ObjectId;
}

export const HelpArticleSchema = SchemaFactory.createForClass(HelpArticle);

HelpArticleSchema.index({ slug: 1 }, { unique: true });
HelpArticleSchema.index({ status: 1, categoryId: 1, sortOrder: 1 });
HelpArticleSchema.index({
  title: 'text',
  summary: 'text',
  tags: 'text',
});
