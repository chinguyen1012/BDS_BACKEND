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

import { RequirePlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { BannersService } from './banners.service';
import {
  CreateBannerDto,
  QueryAdminBannersDto,
  UpdateBannerDto,
} from './dto/banner.dto';

@Controller('platform-admin/banners')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class AdminBannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  findAll(@Query() query: QueryAdminBannersDto) {
    return this.bannersService.findAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findAdminOne(id);
  }

  @Post()
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
