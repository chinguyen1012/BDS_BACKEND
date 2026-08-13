import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import {
  CreateNewsDto,
  QueryAdminNewsDto,
  UpdateNewsDto,
} from './dto/news.dto';
import { NewsService } from './news.service';

@Controller('platform-admin/news')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class AdminNewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  findAll(@Query() query: QueryAdminNewsDto) {
    return this.newsService.findAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findAdminOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateNewsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.newsService.create(dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
