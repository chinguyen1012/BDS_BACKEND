import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { UsersModule } from '../users/users.module';
import { ListingsModule } from '../listings/listings.module';
import { CustomersModule } from '../customers/customers.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [UsersModule, ListingsModule, CustomersModule, TransactionsModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
