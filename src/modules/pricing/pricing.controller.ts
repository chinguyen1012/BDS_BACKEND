import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { RequirePlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import {
  QuoteAuctionDto,
  QuoteListingDto,
  UpdatePricingConfigDto,
} from './dto/quote.dto';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Public()
  @Get('policies')
  getPolicies() {
    return this.pricingService.getPolicies();
  }

  @Public()
  @Post('quote/listing')
  quoteListing(@Body() dto: QuoteListingDto) {
    return this.pricingService.quoteListing(
      dto.package,
      dto.duration,
      dto.accountType ?? 'individual',
    );
  }

  @Public()
  @Post('quote/auction')
  quoteAuction(@Body() dto: QuoteAuctionDto) {
    return this.pricingService.quoteAuction(
      dto.dailyBidAmount,
      dto.durationDays,
      dto.accountType ?? 'individual',
    );
  }
}

@Controller('platform-admin/pricing')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class AdminPricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  get() {
    return this.pricingService.getConfig();
  }

  @Patch()
  async update(@Body() dto: UpdatePricingConfigDto) {
    return this.pricingService.updateConfig(dto);
  }
}
