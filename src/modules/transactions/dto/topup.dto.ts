import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '../../../common/enums/transaction.enums';

export class TopupDto {
  @IsNumber()
  @Min(10000)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  owner?: string;
}
