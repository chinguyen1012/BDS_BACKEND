import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerStatus } from '../../common/enums/customer.enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create({ ...dto, owner: userId });
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: CustomerStatus,
  ) {
    return this.customersService.findAll(userId, status);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
