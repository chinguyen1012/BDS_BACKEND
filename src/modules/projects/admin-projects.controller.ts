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
import {
  CreateProjectDto,
  QueryAdminProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('platform-admin/projects')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class AdminProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: QueryAdminProjectDto) {
    return this.projectsService.findAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findAdminOne(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
