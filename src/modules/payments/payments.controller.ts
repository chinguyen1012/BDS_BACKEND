import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { CreateTopupPaymentDto } from './dto/create-topup-payment.dto';
import { CreateListingPaymentDto } from './dto/create-listing-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('topup')
  createTopup(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTopupPaymentDto,
  ) {
    return this.paymentsService.createTopupPayment(userId, dto);
  }

  @Post('listing')
  createListingPayment(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateListingPaymentDto,
  ) {
    return this.paymentsService.createListingPayment(userId, dto);
  }

  @Get(':invoiceNumber/status')
  getStatus(
    @CurrentUser('sub') userId: string,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    return this.paymentsService.getOrderStatus(invoiceNumber, userId);
  }

  @Post(':invoiceNumber/simulate')
  simulate(
    @CurrentUser('sub') userId: string,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    return this.paymentsService.simulatePayment(invoiceNumber, userId);
  }

  @Post(':invoiceNumber/cancel')
  cancel(
    @CurrentUser('sub') userId: string,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    return this.paymentsService.markCancelled(invoiceNumber, userId);
  }

  @Public()
  @Post('webhook/ipn')
  handleIpn(@Body() payload: Record<string, unknown>) {
    return this.paymentsService.handleIpn(payload);
  }

  @Public()
  @Get('callback/success')
  callbackSuccess(@Query('invoice') invoice: string) {
    return { status: 'success', invoice };
  }
}
