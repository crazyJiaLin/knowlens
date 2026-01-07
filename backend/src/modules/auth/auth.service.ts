import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SmsCode, SmsCodeDocument } from './schemas/sms-code.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { SmsService } from '../aliyun/sms.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(SmsCode.name)
    private smsCodeModel: Model<SmsCodeDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private smsService: SmsService,
  ) {}

  /**
   * 生成6位随机验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 发送短信验证码
   */
  async sendCode(
    phone: string,
  ): Promise<{ success: boolean; message: string }> {
    // 检查1分钟内是否已发送过验证码
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCode = await this.smsCodeModel.findOne({
      phone,
      createdAt: { $gte: oneMinuteAgo },
      used: false,
    });

    if (recentCode) {
      throw new BadRequestException('验证码发送过于频繁，请稍后再试');
    }

    // 生成验证码
    const code = this.generateCode();
    const expiresInMinutes = 5; // 验证码有效期（分钟）
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 保存验证码到数据库
    await this.smsCodeModel.create({
      phone,
      code,
      expiresAt,
      used: false,
    });

    // 发送短信（如果配置了阿里云短信服务）
    // 传递验证码和有效期（分钟）给短信服务
    const smsResult = await this.smsService.sendVerificationCode(
      phone,
      code,
      expiresInMinutes,
    );

    // 如果短信发送失败，开发环境打印验证码到控制台
    if (!smsResult.success) {
      if (this.configService.get<string>('nodeEnv') === 'development') {
        console.log(`[开发环境] 验证码: ${code} (手机号: ${phone})`);
      }
    }

    return {
      success: true,
      message: '验证码已发送',
    };
  }

  /**
   * 验证验证码并登录
   */
  async verifyCode(
    phone: string,
    code: string,
  ): Promise<{
    user: {
      id: string;
      phone: string;
      nickname?: string;
      avatarUrl?: string;
    };
    token: string;
  }> {
    // 查找未使用且未过期的验证码
    const smsCode = await this.smsCodeModel.findOne({
      phone,
      code,
      expiresAt: { $gt: new Date() },
      used: false,
    });

    if (!smsCode) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    // 标记验证码为已使用
    smsCode.used = true;
    await smsCode.save();

    // 查找或创建用户
    let user = await this.userModel.findOne({ phone });
    if (!user) {
      user = await this.userModel.create({
        phone,
        nickname: `用户${phone.slice(-4)}`, // 默认昵称
      });
    }

    // 生成 JWT token
    const payload = {
      sub: user._id.toString(),
      phone: user.phone,
    };
    const token = this.jwtService.sign(payload);

    // 返回用户信息（排除敏感字段）
    const userInfo = {
      id: user._id.toString(),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };

    return {
      user: userInfo,
      token,
    };
  }

  /**
   * 退出登录（清除 token）
   */
  logout(): Promise<{ success: boolean; message: string }> {
    // JWT 是无状态的，退出登录主要是清除客户端的 cookie
    // 如果需要服务端黑名单，可以使用 Redis 存储已失效的 token
    return Promise.resolve({
      success: true,
      message: '退出登录成功',
    });
  }

  /**
   * 根据用户 ID 获取用户信息
   */
  async findUserById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }
}
