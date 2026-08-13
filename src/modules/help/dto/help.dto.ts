import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { HelpStatus } from '../../../common/enums/help.enums';

export class QueryPublicHelpDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QueryAdminHelpDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(HelpStatus)
  status?: HelpStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateHelpDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoryId: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  categoryTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  categoryBlurb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryAccent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsArray()
  @ArrayMinSize(1)
  blocks: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  contentHtml?: string;

  @IsOptional()
  @IsEnum(HelpStatus)
  status?: HelpStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class UpdateHelpDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  categoryTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  categoryBlurb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryAccent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  blocks?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  contentHtml?: string;

  @IsOptional()
  @IsEnum(HelpStatus)
  status?: HelpStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class CreateHelpCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  blurb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accent?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class UpdateHelpCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  key?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  blurb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accent?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}
