import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

import { User, UserDocument } from '../users/schemas/user.schema';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { sanitizeUser } from '../../common/utils/sanitize-user';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  private signToken(user: UserDocument) {
    const payload = { sub: user._id.toString(), email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: sanitizeUser(user),
    };
  }

  async signup(dto: SignupDto) {
    const exists = await this.userModel.findOne({ email: dto.email }).exec();
    if (exists) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email,
      password,
      phone: dto.phone,
      region: dto.region,
    });

    return this.signToken(user);
  }

  async signin(dto: SigninDto) {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password')
      .exec();

    if (!user?.password) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.signToken(user);
  }

  /** JWT stateless — client xóa token khi logout. */
  logout() {
    return { success: true, message: 'Đăng xuất thành công' };
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return sanitizeUser(user);
  }

  async validateUserById(userId: string) {
    return this.userModel.findById(userId).exec();
  }
}
