import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';

export class SubscribeDto {
  @IsIn(['pro', 'business'])
  planId: 'pro' | 'business';

  @Type(() => Number)
  @IsIn([1, 3, 6])
  months: 1 | 3 | 6;
}
