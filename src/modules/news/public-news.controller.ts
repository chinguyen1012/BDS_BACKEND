import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { QueryPublicNewsDto } from './dto/news.dto';
import { NewsService } from './news.service';

@Public()
@Controller('public/news')
export class PublicNewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  findAll(@Query() query: QueryPublicNewsDto) {
    return this.newsService.findPublic(query);
  }

  @Get('categories')
  categories() {
    return this.newsService.findPublicCategories();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.newsService.findPublicOne(slug);
  }
}
