import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerStatus } from '../../../common/enums/customer.enums';

export class CreateCustomerDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  interest?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  owner?: string;
}
