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

  @Prop({ trim: true, index: true })
  province?: string;

  @Prop({ trim: true })
  ward?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  description?: string;

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
