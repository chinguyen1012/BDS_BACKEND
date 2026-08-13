import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DurationOptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  label?: string;
}

export class PackageDurationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionDto)
  durations: DurationOptionDto[];
}

export class PackagesConfigDto {
  @ValidateNested()
  @Type(() => PackageDurationsDto)
  standard: PackageDurationsDto;

  @ValidateNested()
  @Type(() => PackageDurationsDto)
  vip: PackageDurationsDto;

  @ValidateNested()
  @Type(() => PackageDurationsDto)
  diamond: PackageDurationsDto;
}

export class MembershipPolicyDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  listingDiscountPercent: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  auctionFeeDiscountPercent: number;
}

export class MembershipConfigDto {
  @ValidateNested()
  @Type(() => MembershipPolicyDto)
  individual: MembershipPolicyDto;

  @ValidateNested()
  @Type(() => MembershipPolicyDto)
  pro: MembershipPolicyDto;

  @ValidateNested()
  @Type(() => MembershipPolicyDto)
  business: MembershipPolicyDto;
}

export class PlanShowcaseDto {
  @IsString()
  name: string;

  @IsString()
  tagline: string;

  @IsString()
  bestFor: string;

  @IsString()
  priceLabel: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthly?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  yearly?: number;

  @IsArray()
  @IsString({ each: true })
  highlights: string[];

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notIncluded?: string[];

  @IsString()
  ctaHint: string;
}

export class ShowcasesConfigDto {
  @ValidateNested()
  @Type(() => PlanShowcaseDto)
  individual: PlanShowcaseDto;

  @ValidateNested()
  @Type(() => PlanShowcaseDto)
  pro: PlanShowcaseDto;

  @ValidateNested()
  @Type(() => PlanShowcaseDto)
  business: PlanShowcaseDto;
}

export class CompareRowDto {
  @IsString()
  feature: string;

  @IsOptional()
  @IsString()
  group?: string;

  @Allow()
  individual: string | boolean;

  @Allow()
  pro: string | boolean;

  @Allow()
  business: string | boolean;
}

export class FaqItemDto {
  @IsString()
  q: string;

  @IsString()
  a: string;
}

export class UpdatePricingConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PackagesConfigDto)
  packages?: PackagesConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MembershipConfigDto)
  membership?: MembershipConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShowcasesConfigDto)
  showcases?: ShowcasesConfigDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompareRowDto)
  compareRows?: CompareRowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faqs?: FaqItemDto[];
}

export class QuoteListingDto {
  @IsOptional()
  @IsString()
  @IsIn(['standard', 'vip', 'diamond'])
  package?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  @IsIn(['individual', 'pro', 'business'])
  accountType?: string;
}

export class QuoteAuctionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyBidAmount: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsString()
  @IsIn(['individual', 'pro', 'business'])
  accountType?: string;
}
