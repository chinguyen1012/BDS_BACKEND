import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { BannerPlacement } from '../../../common/enums/banner.enums';

export type BannerDocument = HydratedDocument<Banner>;

@Schema({ timestamps: true, collection: 'banners' })
export class Banner {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    enum: BannerPlacement,
    index: true,
  })
  placement: BannerPlacement;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ trim: true, default: '' })
  link: string;

  @Prop({ trim: true, default: '' })
  alt: string;

  @Prop({ default: true, index: true })
  active: boolean;

  @Prop({ default: 0, index: true })
  order: number;

  @Prop({ type: Date, default: null })
  startsAt?: Date | null;

  @Prop({ type: Date, default: null })
  endsAt?: Date | null;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

BannerSchema.index({ placement: 1, active: 1, order: 1 });
