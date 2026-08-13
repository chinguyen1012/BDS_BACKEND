import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import passport from 'passport';

import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { GoogleProfilePayload } from './google.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

function encodeOAuthState(redirect: string) {
  return Buffer.from(JSON.stringify({ r: redirect }), 'utf8').toString(
    'base64url',
  );
}

function decodeOAuthState(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '/dashboard';
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      r?: string;
    };
    if (typeof parsed.r === 'string' && parsed.r.startsWith('/')) {
      return parsed.r;
    }
  } catch {
    // ignore invalid state
  }
  return '/dashboard';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private isGoogleConfigured() {
    const id = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    return Boolean(id && secret && id !== 'not-configured');
  }

  private getFrontendOrigin() {
    const raw = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return raw.split(',')[0]?.trim() || 'http://localhost:3000';
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signin')
  signin(@Body() dto: SigninDto) {
    return this.authService.signin(dto);
  }

  /** Alias cho signin */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: SigninDto) {
    return this.authService.signin(dto);
  }

  @Public()
  @Get('google')
  googleAuth(
    @Req() req: Request,
    @Res() res: Response,
    @Query('redirect') redirect?: string,
  ) {
    if (!this.isGoogleConfigured()) {
      return res.status(503).json({
        message: 'Google OAuth chưa được cấu hình trên server',
      });
    }

    const safeRedirect =
      redirect && redirect.startsWith('/') ? redirect : '/dashboard';
    const state = encodeOAuthState(safeRedirect);

    return passport.authenticate('google', {
      scope: ['email', 'profile'],
      state,
      session: false,
    })(req, res);
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const frontend = this.getFrontendOrigin();
    const redirect = decodeOAuthState(req.query.state);

    try {
      const profile = req.user as GoogleProfilePayload;
      const { accessToken } = await this.authService.signinWithGoogle(profile);
      const url = new URL('/auth/callback', frontend);
      url.searchParams.set('token', accessToken);
      url.searchParams.set('redirect', redirect);
      return res.redirect(url.toString());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không đăng nhập được bằng Google';
      const url = new URL('/login', frontend);
      url.searchParams.set('error', message);
      return res.redirect(url.toString());
    }
  }

  @Post('logout')
  logout() {
    return this.authService.logout();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }
}
