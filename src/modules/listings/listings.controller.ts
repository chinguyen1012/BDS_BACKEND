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

import { ListingsService } from './listings.service';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

// Lưu ý: KHÔNG có endpoint POST /listings.
// Tin đăng chỉ được tạo qua cổng thanh toán: POST /payments/listing
// (sau khi thanh toán thành công). Tránh tạo tin chùa qua Postman.
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser('sub') userId: string, @Query() query: QueryListingDto) {
    return this.listingsService.findAll({ ...query, owner: userId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status-counts')
  countByStatus(@CurrentUser('sub') userId: string) {
    return this.listingsService.countByStatus(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.listingsService.findOneForOwner(id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.updateByOwner(id, userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/resubmit')
  resubmit(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.listingsService.resubmitByOwner(id, userId);
  }

  // Gia hạn bắt buộc qua POST /payments/listing-renewal (có thanh toán).
  // Endpoint free /listings/:id/renew đã gỡ để tránh bỏ qua phí / duyệt.

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.listingsService.removeByOwner(id, userId);
  }
}
