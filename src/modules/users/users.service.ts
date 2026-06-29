import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DEMO_USER_ID } from '../../common/constants';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private async getOrFail(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  findOne(id: string = DEMO_USER_ID) {
    return this.getOrFail(id);
  }

  async update(id: string = DEMO_USER_ID, dto: UpdateUserDto) {
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  async updateSettings(id: string = DEMO_USER_ID, dto: UpdateSettingsDto) {
    const user = await this.getOrFail(id);
    user.settings = { ...user.settings, ...dto };
    await user.save();
    return user.settings;
  }

  /** Cộng/trừ số dư, dùng nội bộ bởi Transactions/Memberships. */
  async adjustBalance(id: string, amount: number) {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $inc: { balance: amount } }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return user;
  }

  getBalance(id: string = DEMO_USER_ID) {
    return this.getOrFail(id).then((user) => ({ balance: user.balance }));
  }
}
