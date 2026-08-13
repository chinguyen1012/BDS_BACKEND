import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';

export class CreateListingRenewalPaymentDto {
  @IsMongoId()
  listingId: string;

  /** Số ngày gia hạn (7 / 10 / 15…). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsString()
  package?: string;
}
