import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AuctionFloorDto {
  @IsInt()
  @Min(1)
  from: number;

  @IsInt()
  @Min(1)
  to: number;

  @IsNumber()
  @Min(0)
  dailyFloor: number;
}

export class UpdateAuctionSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxAuctionSlots?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AuctionFloorDto)
  floors?: AuctionFloorDto[];
}

export class PlaceAuctionBidDto {
  @IsString()
  listingId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  dailyBidAmount: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  durationDays: number;

  /** Đẩy tin Organization — trừ ví org (owner/manager). */
  @IsOptional()
  @IsString()
  organizationId?: string;
}
