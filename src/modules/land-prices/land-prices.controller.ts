import { Controller, Get, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { LandPricesService } from './land-prices.service';

@Public()
@Controller('public/land-prices')
export class LandPricesController {
  constructor(private readonly landPricesService: LandPricesService) {}

  @Get('meta')
  meta(@Query('city') city?: string, @Query('appendix') appendix?: string) {
    return {
      cities: this.landPricesService.listCities(),
      meta: this.landPricesService.getMeta(city, appendix),
      regions: this.landPricesService.getRegions(city, appendix),
      appendices: this.landPricesService.getAppendices(city),
      /** @deprecated — dùng regions */
      wards: this.landPricesService.getRegions(city, appendix).map((r) => r.name),
    };
  }

  @Get()
  list(
    @Query('city') city?: string,
    @Query('appendix') appendix?: string,
    @Query('ward') ward?: string,
    @Query('area') area?: string,
    @Query('region') region?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.landPricesService.query({
      city,
      appendix,
      ward,
      area,
      region,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
