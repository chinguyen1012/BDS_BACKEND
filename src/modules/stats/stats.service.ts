import { Injectable } from '@nestjs/common';

import { ListingsService } from '../listings/listings.service';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { DEMO_USER_ID } from '../../common/constants';

@Injectable()
export class StatsService {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  async overview(owner: string = DEMO_USER_ID) {
    const [listingStats, recentListings, balance, txSummary] =
      await Promise.all([
        this.listingsService.getStats(owner),
        this.listingsService.getRecent(owner),
        this.usersService.getBalance(owner),
        this.transactionsService.summary(owner),
      ]);

    return {
      ...listingStats,
      balance: balance.balance,
      totalTopup: txSummary.totalTopup,
      totalSpend: txSummary.totalSpend,
      recentListings,
    };
  }
}
