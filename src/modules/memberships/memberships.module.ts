import { Module } from '@nestjs/common';

import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { UsersModule } from '../users/users.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [UsersModule, TransactionsModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
})
export class MembershipsModule {}
