import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../../common/enums/transaction.enums';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsString()
  owner?: string;
}
