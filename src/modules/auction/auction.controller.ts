import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireOrgContext, RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { OrgContextGuard } from '../../common/permissions/org-context.guard';
import { PlaceAuctionBidDto } from './dto/auction.dto';
import { AuctionService } from './auction.service';

@Controller('auction')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get('board')
  board(@CurrentUser('sub') userId: string) {
    return this.auctionService.getBoard(userId);
  }

  @Get('my')
  myBids(@CurrentUser('sub') userId: string) {
    return this.auctionService.getMyBids(userId);
  }

  @Get('org/:orgId/my')
  @UseGuards(OrgContextGuard)
  @RequireOrgContext()
  @RequirePermissions(PERMISSIONS.LISTING_APPROVE_MANAGER)
  orgBids(
    @Param('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.auctionService.getOrgBids(orgId, userId);
  }

  @Post('bids')
  place(
    @CurrentUser('sub') userId: string,
    @Body() dto: PlaceAuctionBidDto,
  ) {
    return this.auctionService.placeBid(userId, dto);
  }

  @Post('bids/:id/cancel')
  cancel(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.auctionService.cancelBid(userId, id);
  }
}
