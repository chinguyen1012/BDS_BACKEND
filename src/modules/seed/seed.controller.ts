import { Controller, ForbiddenException, Post } from '@nestjs/common';

import { SeedService } from './seed.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  run() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Seed bị tắt trên production');
    }
    return this.seedService.run();
  }
}
