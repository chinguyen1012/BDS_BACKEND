import { IsEnum, IsMongoId, IsOptional } from 'class-validator';

import { CreateListingDto } from '../../listings/dto/create-listing.dto';
import { ListingContext } from '../../../common/enums/organization.enums';

export class CreateListingPaymentDto extends CreateListingDto {
  @IsOptional()
  @IsEnum(ListingContext)
  context?: ListingContext;

  @IsOptional()
  @IsMongoId()
  organizationId?: string;
}
