import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListingStatus } from '../../../common/enums/listing.enums';

export class QueryListingDto {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  owner?: string;
}
