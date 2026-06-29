import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';

import { User, UserDocument } from '../users/schemas/user.schema';
import { Listing, ListingDocument } from '../listings/schemas/listing.schema';
import {
  Customer,
  CustomerDocument,
} from '../customers/schemas/customer.schema';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';
import {
  ListingPackage,
  ListingStatus,
} from '../../common/enums/listing.enums';
import { CustomerStatus } from '../../common/enums/customer.enums';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../common/enums/transaction.enums';
import { DEMO_USER_ID } from '../../common/constants';

@Injectable()
export class SeedService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async run() {
    const ownerId = new Types.ObjectId(DEMO_USER_ID);

    await Promise.all([
      this.userModel.deleteMany({ _id: ownerId }),
      this.listingModel.deleteMany({ owner: ownerId }),
      this.customerModel.deleteMany({ owner: ownerId }),
      this.transactionModel.deleteMany({ owner: ownerId }),
    ]);

    await this.userModel.create({
      _id: ownerId,
      name: 'Nguyễn Văn A',
      email: 'nguyenvana@gmail.com',
      password: await bcrypt.hash('123456', 10),
      phone: '0901234567',
      region: 'TP. Hồ Chí Minh',
      accountType: 'individual',
      balance: 1380000,
      phoneVerified: true,
      emailVerified: true,
    });

    await this.listingModel.create([
      {
        owner: ownerId,
        title: 'Căn hộ cao cấp view sông',
        detail: 'Quận 2, TP. Hồ Chí Minh',
        price: 4200000000,
        package: ListingPackage.VIP,
        status: ListingStatus.ACTIVE,
        views: 1240,
        contacts: 18,
        images: [
          'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400',
        ],
      },
      {
        owner: ownerId,
        title: 'Nhà phố mặt tiền 4 tầng',
        detail: 'Thuận An, Bình Dương',
        price: 8500000000,
        package: ListingPackage.DIAMOND,
        status: ListingStatus.ACTIVE,
        views: 856,
        contacts: 12,
        images: [
          'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400',
        ],
      },
      {
        owner: ownerId,
        title: 'Đất nền dự án ven sông',
        detail: 'Long An',
        price: 1800000000,
        package: ListingPackage.STANDARD,
        status: ListingStatus.PENDING,
        images: [
          'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400',
        ],
      },
      {
        owner: ownerId,
        title: 'Shophouse kinh doanh sôi động',
        detail: 'Quận 7, TP. Hồ Chí Minh',
        price: 12000000000,
        package: ListingPackage.VIP,
        status: ListingStatus.EXPIRED,
        views: 432,
        contacts: 5,
        images: [
          'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
        ],
      },
    ]);

    await this.customerModel.create([
      {
        owner: ownerId,
        name: 'Trần Thị B',
        phone: '0912 345 678',
        interest: 'Căn hộ cao cấp view sông',
        status: CustomerStatus.NEW,
        lastContact: new Date(),
      },
      {
        owner: ownerId,
        name: 'Lê Văn C',
        phone: '0987 654 321',
        interest: 'Nhà phố mặt tiền 4 tầng',
        status: CustomerStatus.CONTACTED,
        lastContact: new Date(),
      },
      {
        owner: ownerId,
        name: 'Phạm Thị D',
        phone: '0901 222 333',
        interest: 'Shophouse kinh doanh',
        status: CustomerStatus.NEGOTIATING,
        lastContact: new Date(),
      },
    ]);

    await this.transactionModel.create([
      {
        owner: ownerId,
        type: TransactionType.TOPUP,
        description: 'Nạp tiền qua Mã QR',
        amount: 500000,
        method: PaymentMethod.QR,
        status: TransactionStatus.SUCCESS,
      },
      {
        owner: ownerId,
        type: TransactionType.SPEND,
        description: 'Thanh toán gói VIP - Căn hộ view sông',
        amount: -150000,
        method: PaymentMethod.BALANCE,
        status: TransactionStatus.SUCCESS,
      },
      {
        owner: ownerId,
        type: TransactionType.TOPUP,
        description: 'Nạp tiền qua Ví MoMo',
        amount: 1000000,
        method: PaymentMethod.MOMO,
        status: TransactionStatus.SUCCESS,
      },
    ]);

    return { seeded: true, owner: DEMO_USER_ID };
  }
}
