import { Module } from '@nestjs/common';

import { LandPricesController } from './land-prices.controller';
import { LandPricesService } from './land-prices.service';

@Module({
  controllers: [LandPricesController],
  providers: [LandPricesService],
  exports: [LandPricesService],
})
export class LandPricesModule {}
