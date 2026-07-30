import { Body, Controller, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Webhook nhận giao dịch từ SePay (Test/Live).
 *
 * Cấu hình trên my.sepay.vn → Webhook:
 *   https://bdsapi.nvcn.id.vn/api/payment/webhook
 *
 * Loại: Tiền vào | Format: JSON
 */
@Controller('payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}
//300 request/phút là tổng số webhook từ SePay, không phải 300 request cho mỗi người dùng.
  @Public()
  // @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('webhook')
  async webhook(@Body() body: Record<string, unknown>) {
    this.logger.log(`SePay webhook: ${JSON.stringify(body)}`);
    return this.paymentsService.handleBankWebhook(body);
  }
}
