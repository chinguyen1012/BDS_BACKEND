import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Transaction,
  TransactionDocument,
} from './schemas/transaction.schema';
import { TopupDto } from './dto/topup.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../../common/enums/transaction.enums';
import { UsersService } from '../users/users.service';
import { DEMO_USER_ID } from '../../common/constants';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.QR]: 'Mã QR',
  [PaymentMethod.BANK]: 'Chuyển khoản ngân hàng',
  [PaymentMethod.ATM]: 'Thẻ ATM nội địa',
  [PaymentMethod.INTERNATIONAL]: 'Thẻ quốc tế',
  [PaymentMethod.MOMO]: 'Ví MoMo',
  [PaymentMethod.INSTALLMENT]: 'Trả góp thẻ tín dụng',
  [PaymentMethod.BALANCE]: 'Số dư',
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    private readonly usersService: UsersService,
  ) {}

  findAll(owner: string = DEMO_USER_ID, type?: TransactionType) {
    const filter: Record<string, unknown> = {
      owner: new Types.ObjectId(owner),
    };
    if (type) {
      filter.type = type;
    }
    return this.transactionModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  /** Nạp tiền: tạo giao dịch + cộng số dư người dùng (legacy — dùng PaymentsService). */
  async topup(dto: TopupDto) {
    const owner = dto.owner ?? DEMO_USER_ID;
    const transaction = await this.transactionModel.create({
      owner: new Types.ObjectId(owner),
      type: TransactionType.TOPUP,
      description: `Nạp tiền qua ${METHOD_LABELS[dto.method]}`,
      amount: dto.amount,
      method: dto.method,
      status: TransactionStatus.SUCCESS,
    });

    const user = await this.usersService.adjustBalance(owner, dto.amount);

    return { transaction, balance: user.balance };
  }

  createPending(data: {
    owner: string;
    type: TransactionType;
    description: string;
    amount: number;
    method: PaymentMethod;
    invoiceNumber: string;
  }) {
    return this.transactionModel.create({
      owner: new Types.ObjectId(data.owner),
      type: data.type,
      description: data.description,
      amount: data.amount,
      method: data.method,
      status: TransactionStatus.PENDING,
      invoiceNumber: data.invoiceNumber,
    });
  }

  async completePending(transactionId: string) {
    return this.transactionModel
      .findByIdAndUpdate(
        transactionId,
        { status: TransactionStatus.SUCCESS },
        { new: true },
      )
      .exec();
  }

  async failPending(transactionId: string, description?: string) {
    const update: Record<string, unknown> = {
      status: TransactionStatus.FAILED,
    };
    if (description) {
      update.description = description;
    }
    return this.transactionModel
      .findByIdAndUpdate(transactionId, update, { new: true })
      .exec();
  }

  /** Thanh toán bằng số dư: trừ tiền + ghi giao dịch (dùng nội bộ). */
  async spend(owner: string, amount: number, description: string) {
    const transaction = await this.transactionModel.create({
      owner: new Types.ObjectId(owner),
      type: TransactionType.SPEND,
      description,
      amount: -Math.abs(amount),
      method: PaymentMethod.BALANCE,
      status: TransactionStatus.SUCCESS,
    });

    const user = await this.usersService.adjustBalance(owner, -Math.abs(amount));

    return { transaction, balance: user.balance };
  }

  create(dto: CreateTransactionDto) {
    const owner = dto.owner ?? DEMO_USER_ID;
    return this.transactionModel.create({
      ...dto,
      owner: new Types.ObjectId(owner),
    });
  }

  /** Tổng đã nạp / đã chi phục vụ trang số dư. */
  async summary(owner: string = DEMO_USER_ID) {
    const rows = await this.transactionModel
      .aggregate<{ _id: TransactionType; total: number }>([
        {
          $match: {
            owner: new Types.ObjectId(owner),
            status: TransactionStatus.SUCCESS,
          },
        },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ])
      .exec();

    let totalTopup = 0;
    let totalSpend = 0;
    for (const row of rows) {
      if (row._id === TransactionType.SPEND) {
        totalSpend += Math.abs(row.total);
      } else {
        totalTopup += row.total;
      }
    }
    return { totalTopup, totalSpend };
  }
}
