import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { OrgWalletService } from './org-wallet.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import {
  RequireOrgContext,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { PaymentsService } from '../payments/payments.service';
import { CreateTopupPaymentDto } from '../payments/dto/create-topup-payment.dto';

@Controller('organizations/:id/wallet')
@UseGuards(OrgContextGuard)
@RequireOrgContext()
export class OrgWalletController {
  constructor(
    private readonly walletService: OrgWalletService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('balance')
  @RequirePermissions(PERMISSIONS.ORG_WALLET_VIEW)
  balance(@Param('id') id: string) {
    return this.walletService.getBalance(id);
  }

  @Get('transactions')
  @RequirePermissions(PERMISSIONS.ORG_WALLET_VIEW)
  transactions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.listTransactions(id, page, limit);
  }

  @Post('topup')
  @RequirePermissions(PERMISSIONS.ORG_WALLET_TOPUP)
  topup(
    @Param('id') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTopupPaymentDto,
  ) {
    return this.paymentsService.createOrgTopupPayment(userId, orgId, dto);
  }

  @Post('transfer-from-personal')
  transferFromPersonal(
    @Param('id') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { amount: number },
  ) {
    return this.walletService.transferFromPersonal(orgId, userId, body.amount);
  }
}
