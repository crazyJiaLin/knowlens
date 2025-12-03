import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from '../auth.service';

interface JwtPayload {
  sub: string;
  phone: string;
  iat?: number;
  exp?: number;
}

interface RequestWithCookies {
  cookies?: {
    token?: string;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 从 Cookie 中提取 token
        (request: Request): string | null => {
          const reqWithCookies = request as Request & RequestWithCookies;
          return reqWithCookies?.cookies?.token || null;
        },
        // 也可以从 Authorization header 中提取（备用）
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.secret') ||
        'your-jwt-secret-key-at-least-32-characters',
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('无效的 token');
    }

    const user = await this.authService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      id: user._id.toString(),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };
  }
}
