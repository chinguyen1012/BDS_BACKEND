import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { QueryPublicProjectDto } from './dto/query-public-project.dto';
import { ProjectsService } from './projects.service';

@Public()
@Controller('public/projects')
export class PublicProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: QueryPublicProjectDto) {
    return this.projectsService.findPublicProjects(query);
  }

  @Get('developers')
  developers() {
    return this.projectsService.findPublicDevelopers();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.projectsService.findPublicOne(slug);
  }
}
