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
    // 初始化阿里云短信客户端
    const accessKeyId = this.configService.get<string>(
      'aliyun.sms.accessKeyId',
    );
    const accessKeySecret = this.configService.get<string>(
      'aliyun.sms.accessKeySecret',
    );

    if (accessKeyId && accessKeySecret) {
      this.smsClient = new Core({
        accessKeyId,
        accessKeySecret,
        endpoint: 'https://dysmsapi.aliyuncs.com',
        apiVersion: '2017-05-25',
      });
      this.logger.log('阿里云短信客户端初始化成功');
    } else {
      this.logger.warn('阿里云短信配置不完整，短信功能将不可用');
    }
  }

  /**
   * 发送短信验证码
   * @param phone 手机号
   * @param code 验证码
   * @returns 发送结果
   */
  async sendVerificationCode(
    phone: string,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.smsClient) {
      this.logger.warn('短信客户端未初始化，跳过发送');
      return {
        success: false,
        message: '短信服务未配置',
      };
    }

    const signName = this.configService.get<string>('aliyun.sms.signName');
    const templateCode = this.configService.get<string>(
      'aliyun.sms.templateCode',
    );

    if (!signName || !templateCode) {
      this.logger.warn('短信签名或模板未配置，跳过发送');
      return {
        success: false,
        message: '短信模板未配置',
      };
    }

    try {
      const params = {
        PhoneNumbers: phone,
        SignName: signName,
        TemplateCode: templateCode,
        TemplateParam: JSON.stringify({ code }),
      };

      const requestOption = {
        method: 'POST',
      };

      // @alicloud/pop-core 的 request 方法返回 unknown 类型，需要进行类型断言
      const response = await this.smsClient.request(
        'SendSms',
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
