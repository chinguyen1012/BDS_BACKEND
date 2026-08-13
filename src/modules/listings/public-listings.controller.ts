import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { ListingsService } from './listings.service';
import { QueryPublicListingDto } from './dto/query-public-listing.dto';

@Public()
@Controller('public/listings')
export class PublicListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  findAll(@Query() query: QueryPublicListingDto) {
    return this.listingsService.findPublicListings(query);
  }

  @Get('areas/top')
  topWards(
    @Query('province') province: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(20, Math.max(1, parseInt(limit, 10) || 10)) : 10;
    return this.listingsService.findTopWardsByProvince(province, n);
  }

  @Get('provinces/top')
  topProvinces(
    @Query('purpose') purpose?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(30, Math.max(1, parseInt(limit, 10) || 10)) : 10;
    const p = purpose === 'sale' || purpose === 'rent' ? purpose : undefined;
    return this.listingsService.findTopProvinces(p, n);
  }

  @Get('recommended')
  recommended(
    @Query('excludeId') excludeId: string,
    @Query('province') province?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(12, Math.max(1, parseInt(limit, 10) || 9)) : 9;
    return this.listingsService.findRecommendedListings(
      province,
      excludeId,
      n,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findPublicOne(id);
  }

  @Post(':id/contact')
  recordContact(@Param('id') id: string) {
    return this.listingsService.recordPublicContact(id);
  }
}
