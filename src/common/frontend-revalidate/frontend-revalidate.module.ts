import { Global, Module } from '@nestjs/common';

import { FrontendRevalidateService } from './frontend-revalidate.service';

@Global()
@Module({
  providers: [FrontendRevalidateService],
  exports: [FrontendRevalidateService],
})
export class FrontendRevalidateModule {}
