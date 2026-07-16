import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PLATFORM_ADMIN_KEY } from '../decorators/platform-admin.decorator';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import { SystemRole } from '../enums/user.enums';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub as string | undefined;
    if (!userId) {
      throw new ForbiddenException('Vui lòng đăng nhập');
    }

    const user = await this.userModel.findById(userId).select('systemRole').exec();

    if (!user || user.systemRole !== SystemRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Không có quyền quản trị nền tảng');
    }

    request.platformAdmin = { userId, systemRole: user.systemRole };
    return true;
  }
}
