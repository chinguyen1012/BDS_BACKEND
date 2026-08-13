import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

export type GoogleProfilePayload = {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') ?? 'not-configured';
    const clientSecret =
      config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'not-configured';
    const callbackURL =
      config.get<string>('GOOGLE_CALLBACK_URL') ??
      `${(config.get<string>('API_URL') ?? 'http://localhost:9000/api').replace(/\/api\/?$/, '')}/api/auth/google/callback`;

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value?.trim().toLowerCase();
    if (!email) {
      done(
        new UnauthorizedException('Google không cung cấp email'),
        undefined,
      );
      return;
    }

    const payload: GoogleProfilePayload = {
      googleId: profile.id,
      email,
      name: profile.displayName?.trim() || email.split('@')[0],
      avatar: profile.photos?.[0]?.value,
    };
    done(null, payload);
  }
}
