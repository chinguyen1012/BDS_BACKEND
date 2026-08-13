import { Controller, Get, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { BannersService } from './banners.service';
import { QueryPublicBannersDto } from './dto/banner.dto';

@Public()
@Controller('public/banners')
export class PublicBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findAll(@Query() query: QueryPublicBannersDto) {
    return this.bannersService.findPublic(query.placement);
  }
}
