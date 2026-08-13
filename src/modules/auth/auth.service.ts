import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

import { User, UserDocument } from '../users/schemas/user.schema';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { GoogleProfilePayload } from './google.strategy';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { expireMembershipIfNeeded } from '../users/membership.util';

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
      if (exists.googleId && !exists.password) {
        throw new ConflictException(
          'Email đã đăng ký bằng Google. Hãy đăng nhập bằng Google.',
        );
      }
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
      throw new UnauthorizedException(
        user?.googleId
          ? 'Tài khoản này đăng nhập bằng Google. Vui lòng dùng nút Google.'
          : 'Email hoặc mật khẩu không đúng',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    await expireMembershipIfNeeded(user);
    return this.signToken(user);
  }

  async signinWithGoogle(profile: GoogleProfilePayload) {
    let user = await this.userModel.findOne({ googleId: profile.googleId }).exec();

    if (!user) {
      user = await this.userModel.findOne({ email: profile.email }).exec();
      if (user) {
        if (user.googleId && user.googleId !== profile.googleId) {
          throw new ConflictException('Email đã liên kết tài khoản Google khác');
        }
        user.googleId = profile.googleId;
        user.emailVerified = true;
        if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
        if (!user.name?.trim()) user.name = profile.name;
        await user.save();
      } else {
        user = await this.userModel.create({
          name: profile.name,
          email: profile.email,
          googleId: profile.googleId,
          avatar: profile.avatar,
          emailVerified: true,
          authProvider: 'google',
        });
      }
    } else {
      if (!user.avatar && profile.avatar) {
        user.avatar = profile.avatar;
        await user.save();
      }
    }

    await expireMembershipIfNeeded(user);
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
    await expireMembershipIfNeeded(user);
    return sanitizeUser(user);
  }

  async validateUserById(userId: string) {
    return this.userModel.findById(userId).exec();
  }
}
