import { Module } from '@nestjs/common';

import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { ListingsModule } from '../listings/listings.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ListingsModule, TransactionsModule, UsersModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
