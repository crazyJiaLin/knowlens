import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送短信验证码' })
  @ApiResponse({ status: 200, description: '验证码发送成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  async sendCode(@Body() sendCodeDto: SendCodeDto) {
    return this.authService.sendCode(sendCodeDto.phone);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '验证码登录' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '验证码错误或已过期' })
  async verify(
    @Body() verifyCodeDto: VerifyCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyCode(
      verifyCodeDto.phone,
      verifyCodeDto.code,
    );
    const user = result.user;
    const token = result.token;

    // 设置 HttpOnly Cookie
    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '7d';
    const maxAge = this.parseExpiresIn(expiresIn);

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction, // 生产环境使用 HTTPS
      sameSite: 'lax',
      maxAge: maxAge * 1000, // 转换为毫秒
      path: '/',
    });

    return {
      success: true,
      user: user as {
        id: string;
        phone: string;
        nickname?: string;
        avatarUrl?: string;
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '退出登录' })
  @ApiResponse({ status: 200, description: '退出登录成功' })
  async logout(@Res({ passthrough: true }) res: Response) {
    // 清除 Cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: this.configService.get<string>('nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return this.authService.logout();
  }

  /**
   * 解析 JWT expiresIn 字符串为秒数
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // 默认7天

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
