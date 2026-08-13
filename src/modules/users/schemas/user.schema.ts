import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { SystemRole } from '../../../common/enums/user.enums';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class UserSettings {
  @Prop({ default: true })
  emailOnContact: boolean;

  @Prop({ default: true })
  smsOnExpire: boolean;

  @Prop({ default: false })
  promotions: boolean;

  @Prop({ default: true })
  showPhonePublic: boolean;

  @Prop({ default: true })
  showProfilePublic: boolean;

  @Prop({ default: false })
  twoFactorEnabled: boolean;
}

const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({ trim: true })
  region: string;

  @Prop()
  avatar: string;

  @Prop({ enum: ['individual', 'pro', 'business'], default: 'individual' })
  accountType: string;

  /** Chu kỳ gói cũ (monthly/yearly) — giữ để đọc user legacy. */
  @Prop({ enum: ['monthly', 'yearly'], required: false })
  membershipCycle?: 'monthly' | 'yearly';

  /** Số tháng lần mua gần nhất: 1 | 3 | 6. */
  @Prop({ required: false })
  membershipMonths?: number;

  /** Hết hạn thì accountType về individual. User cũ chưa có field thì coi như còn hạn. */
  @Prop({ required: false })
  membershipExpiresAt?: Date;

  @Prop({ enum: SystemRole, default: SystemRole.USER })
  systemRole: SystemRole;

  @Prop({ default: 0, min: 0 })
  balance: number;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ required: false, select: false })
  password?: string;

  @Prop({ trim: true, sparse: true, unique: true })
  googleId?: string;

  @Prop({ enum: ['local', 'google'], default: 'local' })
  authProvider: 'local' | 'google';

  @Prop({ type: UserSettingsSchema, default: () => ({}) })
  settings: UserSettings;
}

export const UserSchema = SchemaFactory.createForClass(User);
