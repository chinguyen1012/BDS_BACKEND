import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PaymentsController } from './payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentsService } from './payments.service';
import { SepayService } from './sepay.service';
import {
  PaymentOrder,
  PaymentOrderSchema,
} from './schemas/payment-order.schema';
import { TransactionsModule } from '../transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { ListingsModule } from '../listings/listings.module';
import { OrgWalletModule } from '../org-wallet/org-wallet.module';
import { BudgetPoliciesModule } from '../budget-policies/budget-policies.module';
import { OrgMembershipsModule } from '../org-memberships/org-memberships.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentOrder.name, schema: PaymentOrderSchema },
    ]),
    TransactionsModule,
    UsersModule,
    ListingsModule,
    PricingModule,
    forwardRef(() => OrgWalletModule),
    BudgetPoliciesModule,
    OrgMembershipsModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController, PaymentWebhookController],
  providers: [PaymentsService, SepayService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
