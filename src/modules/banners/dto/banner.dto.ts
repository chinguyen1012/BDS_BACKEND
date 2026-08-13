import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { BannerPlacement } from '../../../common/enums/banner.enums';

export class QueryAdminBannersDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @IsOptional()
  @IsString()
  active?: string;
}

export class QueryPublicBannersDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;
}

export class CreateBannerDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsEnum(BannerPlacement)
  placement: BannerPlacement;

  @IsString()
  @MaxLength(500)
  image: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}
