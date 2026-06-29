import { IsIn, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsIn(['pro', 'business'])
  planId: 'pro' | 'business';

  @IsIn(['monthly', 'yearly'])
  cycle: 'monthly' | 'yearly';

  @IsOptional()
  @IsString()
  owner?: string;
}
