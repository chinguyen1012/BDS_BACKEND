import { Controller, Post } from '@nestjs/common';

import { SeedService } from './seed.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  run() {
    return this.seedService.run();
  }
}
