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
import {
  normalizePagination,
  paginatedResult,
} from '../../common/utils/pagination.util';

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

  findAll(
    owner: string = DEMO_USER_ID,
    type?: TransactionType,
    page?: number | string,
    limit?: number | string,
  ) {
    const filter: Record<string, unknown> = {
      owner: new Types.ObjectId(owner),
    };
    if (type) {
      filter.type = type;
    }

    const { page: safePage, limit: safeLimit, skip } = normalizePagination(
      page,
      limit,
    );

    return Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.transactionModel.countDocuments(filter).exec(),
    ]).then(([items, total]) =>
      paginatedResult(items, total, safePage, safeLimit),
    );
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

  /** Hoàn tiền về số dư ví (dùng nội bộ). */
  async refund(owner: string, amount: number, description: string) {
    const value = Math.abs(amount);
    if (value <= 0) {
      const user = await this.usersService.findOne(owner);
      return { transaction: null, balance: user.balance };
    }

    const transaction = await this.transactionModel.create({
      owner: new Types.ObjectId(owner),
      type: TransactionType.REFUND,
      description,
      amount: value,
      method: PaymentMethod.BALANCE,
      status: TransactionStatus.SUCCESS,
    });

    const user = await this.usersService.adjustBalance(owner, value);

    return { transaction, balance: user.balance };
  }

  create(dto: CreateTransactionDto) {
    const owner = dto.owner ?? DEMO_USER_ID;
    return this.transactionModel.create({
      ...dto,
      owner: new Types.ObjectId(owner),
    });
  }

  /**
   * Tổng đã nạp / đã chi phục vụ trang số dư.
   *
   * - Đã nạp: topup + thanh toán QR/bank trực tiếp (tiền từ ngoài vào)
   * - Đã chi: spend − hoàn tiền (net). VD: trả 14k → hoàn 14k → trừ ví 14k gửi lại
   *   vẫn chỉ tính 14k đã chi, không nhân đôi.
   */
  async summary(owner: string = DEMO_USER_ID) {
    const rows = await this.transactionModel
      .aggregate<{
        _id: { type: TransactionType; method?: PaymentMethod };
        total: number;
      }>([
        {
          $match: {
            owner: new Types.ObjectId(owner),
            status: TransactionStatus.SUCCESS,
          },
        },
        {
          $group: {
            _id: { type: '$type', method: '$method' },
            total: { $sum: '$amount' },
          },
        },
      ])
      .exec();

    let totalTopup = 0;
    let grossSpend = 0;
    let totalRefund = 0;

    for (const row of rows) {
      const type = row._id.type;
      const method = row._id.method;
      const abs = Math.abs(row.total ?? 0);

      if (type === TransactionType.TOPUP) {
        totalTopup += abs;
        continue;
      }

      if (type === TransactionType.SPEND) {
        grossSpend += abs;
        // Thanh toán trực tiếp QR/bank = tiền đưa vào hệ thống
        if (method && method !== PaymentMethod.BALANCE) {
          totalTopup += abs;
        }
        continue;
      }

      if (type === TransactionType.REFUND) {
        totalRefund += abs;
      }
    }

    const totalSpend = Math.max(0, grossSpend - totalRefund);

    return { totalTopup, totalSpend };
  }
}
