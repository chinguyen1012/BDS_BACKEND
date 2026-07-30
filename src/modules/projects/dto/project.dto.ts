import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ProjectStatus } from '../../../common/enums/project.enums';

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  developer!: string;

  @IsOptional()
  @IsString()
  developerLogo?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  floorPlanImages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  infrastructureImages?: string[];

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  introduction?: string;

  @IsOptional()
  @IsString()
  floorPlanContent?: string;

  @IsOptional()
  @IsString()
  infrastructure?: string;

  @IsOptional()
  @IsString()
  locationNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceFrom?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceTo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  areaFrom?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  areaTo?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyTypes?: string[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  developer?: string;

  @IsOptional()
  @IsString()
  developerLogo?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  floorPlanImages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  infrastructureImages?: string[];

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  introduction?: string;

  @IsOptional()
  @IsString()
  floorPlanContent?: string;

  @IsOptional()
  @IsString()
  infrastructure?: string;

  @IsOptional()
  @IsString()
  locationNote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceFrom?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceTo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  areaFrom?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  areaTo?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyTypes?: string[];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class QueryAdminProjectDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
