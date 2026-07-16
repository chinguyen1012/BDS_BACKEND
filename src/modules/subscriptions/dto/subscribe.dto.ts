import { IsIn } from 'class-validator';

export class SubscribeDto {
  @IsIn(['pro', 'business'])
  planId: 'pro' | 'business';

  @IsIn(['monthly', 'yearly'])
  cycle: 'monthly' | 'yearly';
}
