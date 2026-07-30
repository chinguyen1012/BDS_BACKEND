import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { NewsStatus } from '../../../common/enums/news.enums';

export type NewsDocument = HydratedDocument<NewsArticle>;

@Schema({ timestamps: true, collection: 'news_articles' })
export class NewsArticle {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  excerpt: string;

  @Prop({ required: true })
  content: string;

  @Prop({ trim: true })
  coverImage?: string;

  @Prop({ trim: true, index: true, default: 'Thị trường' })
  category: string;

  @Prop({
    enum: NewsStatus,
    default: NewsStatus.DRAFT,
    index: true,
  })
  status: NewsStatus;

  @Prop({ default: false, index: true })
  featured: boolean;

  @Prop({ trim: true, default: 'Luxury Estate' })
  authorName: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  authorId?: Types.ObjectId;

  @Prop({ type: Date, default: null, index: true })
  publishedAt?: Date | null;

  @Prop({ default: 0, min: 0 })
  views: number;
}

export const NewsArticleSchema = SchemaFactory.createForClass(NewsArticle);

NewsArticleSchema.index({ slug: 1 }, { unique: true });
NewsArticleSchema.index({ status: 1, publishedAt: -1 });
NewsArticleSchema.index({ status: 1, featured: -1, publishedAt: -1 });
