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
  CreateHelpCategoryDto,
  CreateHelpDto,
  QueryAdminHelpDto,
  UpdateHelpCategoryDto,
  UpdateHelpDto,
} from './dto/help.dto';
import { HelpService } from './help.service';

@Controller('platform-admin/help')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class AdminHelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('categories')
  listCategories() {
    return this.helpService.listCategoriesAdmin();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateHelpCategoryDto) {
    return this.helpService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateHelpCategoryDto,
  ) {
    return this.helpService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.helpService.removeCategory(id);
  }

  @Get()
  findAll(@Query() query: QueryAdminHelpDto) {
    return this.helpService.findAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.helpService.findAdminOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateHelpDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.helpService.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHelpDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.helpService.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.helpService.remove(id);
  }
}
