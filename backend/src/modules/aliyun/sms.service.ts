import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Core from '@alicloud/pop-core';

// 阿里云短信服务响应类型
interface AliyunSmsResponse {
  Code?: string;
  Message?: string;
  RequestId?: string;
  BizId?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private smsClient: Core | null = null;

  constructor(private configService: ConfigService) {
    // 初始化阿里云短信认证服务客户端
    const accessKeyId = this.configService.get<string>(
      'aliyun.sms.accessKeyId',
    );
    const accessKeySecret = this.configService.get<string>(
      'aliyun.sms.accessKeySecret',
    );

    if (accessKeyId && accessKeySecret) {
      // 使用短信认证服务 endpoint（个人账号可用，无需申请签名和模板）
      const endpoint =
        this.configService.get<string>('aliyun.sms.endpoint') ||
        'https://dypnsapi.aliyuncs.com';

      this.smsClient = new Core({
        accessKeyId,
        accessKeySecret,
        endpoint,
        apiVersion: '2017-05-25',
      });
      this.logger.log('阿里云短信认证服务客户端初始化成功');
    } else {
      this.logger.warn('阿里云短信配置不完整，短信功能将不可用');
    }
  }

  /**
   * 发送短信验证码（使用短信认证服务）
   * @param phone 手机号
   * @param code 验证码
   * @param min 验证码有效期（分钟），默认 5 分钟
   * @returns 发送结果
   */
  async sendVerificationCode(
    phone: string,
    code: string,
    min: number = 5,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.smsClient) {
      this.logger.warn('短信客户端未初始化，跳过发送');
      return {
        success: false,
        message: '短信服务未配置',
      };
    }

    // 短信认证服务：无需申请签名和模板，使用系统默认
    // 如果配置了签名和模板，可以使用自定义的
    const signName = this.configService.get<string>('aliyun.sms.signName');
    const templateCode = this.configService.get<string>(
      'aliyun.sms.templateCode',
    );

    try {
      // 使用 SendSmsVerifyCode API（短信认证服务）
      // TemplateParam 需要包含 code 和 min 参数
      // min 必须是字符串格式的数字，表示验证码有效期（分钟）
      const params = {
        PhoneNumber: phone, // 短信认证服务使用 PhoneNumber（单数）
        SignName: signName || '', // 可选，系统会使用默认签名
        TemplateCode: templateCode || '', // 可选，系统会使用默认模板
        TemplateParam: JSON.stringify({
          code, // 验证码
          min: min.toString(), // 有效期（分钟），必须是字符串格式
        }),
      };

      const requestOption = {
        method: 'POST',
      };

      const response = await this.smsClient.request(
        'SendSmsVerifyCode',
        params,
        requestOption,
      );
      const smsResponse = response as AliyunSmsResponse;

      if (smsResponse.Code === 'OK') {
        this.logger.log(`短信验证码发送成功: ${phone}`);
        return {
          success: true,
          message: '验证码发送成功',
        };
      } else {
        const errorMsg = smsResponse.Message || '发送失败';
        this.logger.error(`短信发送失败: ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`短信发送异常: ${errorMessage}`);
      return {
        success: false,
        message: `短信发送失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 检查短信服务是否可用
   */
  isAvailable(): boolean {
    return this.smsClient !== null;
  }
}
