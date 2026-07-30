import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { AuctionService } from './auction.service';

@Public()
@Controller('public/auction')
export class PublicAuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get('settings')
  settings() {
    return this.auctionService.getAuctionSettings();
  }

  @Get('board')
  board() {
    return this.auctionService.getBoard();
  }
}
