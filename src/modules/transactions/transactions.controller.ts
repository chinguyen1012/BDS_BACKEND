import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { TransactionsService } from './transactions.service';
import { TopupDto } from './dto/topup.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionType } from '../../common/enums/transaction.enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('type') type?: TransactionType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll(userId, type, page, limit);
  }

  @Get('summary')
  summary(@CurrentUser('sub') userId: string) {
    return this.transactionsService.summary(userId);
  }

  @Post('topup')
  topup(@CurrentUser('sub') userId: string, @Body() dto: TopupDto) {
    return this.transactionsService.topup({ ...dto, owner: userId });
  }

  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create({ ...dto, owner: userId });
  }
}
