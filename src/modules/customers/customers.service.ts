import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerStatus } from '../../common/enums/customer.enums';
import { DEMO_USER_ID } from '../../common/constants';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
  ) {}

  create(dto: CreateCustomerDto) {
    const owner = dto.owner ?? DEMO_USER_ID;
    return this.customerModel.create({
      ...dto,
      owner: new Types.ObjectId(owner),
      lastContact: new Date(),
    });
  }

  findAll(owner: string = DEMO_USER_ID, status?: CustomerStatus) {
    const filter: Record<string, unknown> = {
      owner: new Types.ObjectId(owner),
    };
    if (status) {
      filter.status = status;
    }
    return this.customerModel.find(filter).sort({ lastContact: -1 }).exec();
  }

  count(owner: string = DEMO_USER_ID) {
    return this.customerModel
      .countDocuments({ owner: new Types.ObjectId(owner) })
      .exec();
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.customerModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    return customer;
  }

  async remove(id: string) {
    const customer = await this.customerModel.findByIdAndDelete(id).exec();
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }
    return { deleted: true, id };
  }
}
