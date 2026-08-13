import { Module } from '@nestjs/common';

import { SubscriptionsController, MembershipsLegacyController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { UsersModule } from '../users/users.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [UsersModule, TransactionsModule, PricingModule],
  controllers: [SubscriptionsController, MembershipsLegacyController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
