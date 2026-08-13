import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { RequirePlatformAdmin } from '../../common/decorators/platform-admin.decorator';
import { PlatformAdminGuard } from '../../common/permissions/platform-admin.guard';
import { UpdateAuctionSettingsDto } from './dto/auction.dto';
import { AuctionService } from './auction.service';

@Controller('platform-admin/auction-settings')
@UseGuards(PlatformAdminGuard)
@RequirePlatformAdmin()
export class AdminAuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get()
  get() {
    return this.auctionService.getAuctionSettings();
  }

  @Patch()
  update(@Body() dto: UpdateAuctionSettingsDto) {
    return this.auctionService.updateAuctionSettings(dto);
  }
}
