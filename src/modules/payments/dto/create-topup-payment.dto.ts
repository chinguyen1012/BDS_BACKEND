import { IsEnum, IsNumber, Min } from 'class-validator';

import { PaymentMethod } from '../../../common/enums/transaction.enums';

export class CreateTopupPaymentDto {
  @IsNumber()
  @Min(10000)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod = PaymentMethod.QR;
}
