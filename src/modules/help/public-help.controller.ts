import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { QueryPublicHelpDto } from './dto/help.dto';
import { HelpService } from './help.service';

@Public()
@Controller('public/help')
export class PublicHelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get()
  findAll(@Query() query: QueryPublicHelpDto) {
    return this.helpService.findPublic(query);
  }

  @Get('categories')
  categories() {
    return this.helpService.findPublicCategoriesWithArticles();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.helpService.findPublicOne(slug);
  }
}
