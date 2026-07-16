import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Organization,
  OrganizationDocument,
} from '../organizations/schemas/organization.schema';
import {
  OrgTransaction,
  OrgTransactionDocument,
} from './schemas/org-transaction.schema';
import { OrgTransactionType } from '../../common/enums/organization.enums';
import { TransactionStatus } from '../../common/enums/transaction.enums';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class OrgWalletService {
  constructor(
    @InjectModel(Organization.name)
    private readonly orgModel: Model<OrganizationDocument>,
    @InjectModel(OrgTransaction.name)
    private readonly txModel: Model<OrgTransactionDocument>,
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getBalance(organizationId: string) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');
    return { balance: org.walletBalance, organizationId };
  }

  listTransactions(organizationId: string, limit = 50) {
    return this.txModel
      .find({ organizationId: new Types.ObjectId(organizationId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async adjustBalance(
    organizationId: string,
    amount: number,
    meta: {
      type: OrgTransactionType;
      description: string;
      performedBy: string;
      listingId?: string;
      paymentOrderId?: string;
      invoiceNumber?: string;
      status?: TransactionStatus;
    },
  ) {
    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');

    const next = org.walletBalance + amount;
    if (next < 0) {
      throw new BadRequestException('Số dư ví Organization không đủ');
    }

    org.walletBalance = next;
    await org.save();

    await this.txModel.create({
      organizationId: new Types.ObjectId(organizationId),
      type: meta.type,
      amount,
      balanceAfter: next,
      description: meta.description,
      performedBy: new Types.ObjectId(meta.performedBy),
      listingId: meta.listingId
        ? new Types.ObjectId(meta.listingId)
        : undefined,
      paymentOrderId: meta.paymentOrderId
        ? new Types.ObjectId(meta.paymentOrderId)
        : undefined,
      invoiceNumber: meta.invoiceNumber,
      status: meta.status ?? TransactionStatus.SUCCESS,
    });

    return { balance: org.walletBalance };
  }

  /** Chuyển tiền từ ví cá nhân sang ví Organization — chỉ Owner. */
  async transferFromPersonal(
    organizationId: string,
    ownerUserId: string,
    amount: number,
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền không hợp lệ');
    }

    const org = await this.orgModel.findById(organizationId).exec();
    if (!org) throw new NotFoundException('Không tìm thấy Organization');

    if (org.ownerId.toString() !== ownerUserId) {
      throw new ForbiddenException('Chỉ Owner mới được chuyển tiền vào ví Organization');
    }

    const user = await this.usersService.findOne(ownerUserId);
    if ((user.balance ?? 0) < amount) {
      throw new BadRequestException('Số dư cá nhân không đủ');
    }

    await this.transactionsService.spend(
      ownerUserId,
      amount,
      `Chuyển vào ví Organization: ${org.name}`,
    );

    const result = await this.adjustBalance(organizationId, amount, {
      type: OrgTransactionType.TRANSFER,
      description: `Chuyển từ ví cá nhân (+${amount.toLocaleString('vi-VN')}đ)`,
      performedBy: ownerUserId,
    });

    const updatedUser = await this.usersService.findOne(ownerUserId);

    return {
      organizationBalance: result.balance,
      personalBalance: updatedUser.balance,
      amount,
    };
  }
}
