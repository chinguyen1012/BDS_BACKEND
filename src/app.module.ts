import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AddressModule } from './modules/address/address.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { ListingsModule } from './modules/listings/listings.module';
import { CustomersModule } from './modules/customers/customers.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { OrgWalletModule } from './modules/org-wallet/org-wallet.module';
import { BudgetPoliciesModule } from './modules/budget-policies/budget-policies.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { StatsModule } from './modules/stats/stats.module';
import { SeedModule } from './modules/seed/seed.module';
import { UploadModule } from './modules/upload/upload.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { NewsModule } from './modules/news/news.module';
import { HelpModule } from './modules/help/help.module';
import { AuctionModule } from './modules/auction/auction.module';
import { LandPricesModule } from './modules/land-prices/land-prices.module';
import { BannersModule } from './modules/banners/banners.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { FrontendRevalidateModule } from './common/frontend-revalidate/frontend-revalidate.module';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FrontendRevalidateModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: isProd ? 120 : 300,
      },
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        maxPoolSize: isProd ? 50 : 10,
      }),
    }),
    AuthModule,
    AddressModule,
    UsersModule,
    ListingsModule,
    CustomersModule,
    TransactionsModule,
    SubscriptionsModule,
    OrganizationsModule,
    OrgWalletModule,
    BudgetPoliciesModule,
    ApprovalModule,
    PlatformAdminModule,
    AuditLogsModule,
    NotificationsModule,
    DepartmentsModule,
    StatsModule,
    ...(isProd ? [] : [SeedModule]),
    UploadModule,
    PaymentsModule,
    ProjectsModule,
    NewsModule,
    HelpModule,
    AuctionModule,
    LandPricesModule,
    BannersModule,
    PricingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
