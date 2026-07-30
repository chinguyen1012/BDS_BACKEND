import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { ProjectStatus } from '../../../common/enums/project.enums';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true, index: true })
  developer!: string;

  @Prop({ trim: true })
  developerLogo?: string;

  @Prop({ trim: true })
  coverImage?: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  /** Gallery mặt bằng dự án */
  @Prop({ type: [String], default: [] })
  floorPlanImages!: string[];

  /** Gallery hạ tầng */
  @Prop({ type: [String], default: [] })
  infrastructureImages!: string[];

  @Prop({ trim: true, index: true })
  province?: string;

  /** Quận/Huyện (có thể trống theo địa giới mới) */
  @Prop({ trim: true })
  district?: string;

  @Prop({ trim: true })
  ward?: string;

  @Prop({ trim: true })
  street?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  /** Tổng quan ngắn */
  @Prop({ trim: true })
  description?: string;

  /** Giới thiệu chi tiết (HTML/text dài) */
  @Prop({ trim: true })
  introduction?: string;

  /** Nội dung mặt bằng */
  @Prop({ trim: true })
  floorPlanContent?: string;

  /** Tổng thể hạ tầng */
  @Prop({ trim: true })
  infrastructure?: string;

  /** Mô tả vị trí */
  @Prop({ trim: true })
  locationNote?: string;

  @Prop({ type: [String], default: [] })
  highlights!: string[];

  @Prop({ enum: ProjectStatus, default: ProjectStatus.SELLING, index: true })
  status!: ProjectStatus;

  @Prop({ min: 0 })
  priceFrom?: number;

  @Prop({ min: 0 })
  priceTo?: number;

  @Prop({ min: 0 })
  areaFrom?: number;

  @Prop({ min: 0 })
  areaTo?: number;

  @Prop({ type: [String], default: [] })
  propertyTypes!: string[];

  @Prop({ default: false, index: true })
  featured!: boolean;

  @Prop({ default: true, index: true })
  published!: boolean;

  @Prop({ default: 0, min: 0 })
  views!: number;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

ProjectSchema.index({ slug: 1 }, { unique: true });
ProjectSchema.index({ published: 1, featured: -1, createdAt: -1 });
