import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailOnContact?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOnExpire?: boolean;

  @IsOptional()
  @IsBoolean()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  showPhonePublic?: boolean;

  @IsOptional()
  @IsBoolean()
  showProfilePublic?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;
}
