import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Moonshot AI 服务
 * 用于字幕格式规整、语义分段和错别字纠正
 */
@Injectable()
export class MoonshotService {
  private readonly logger = new Logger(MoonshotService.name);
  private readonly client: OpenAI | null;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('MOONSHOT_API_KEY');
    const baseURL =
      this.configService.get<string>('MOONSHOT_BASE_URL') ||
      'https://api.moonshot.cn/v1';

    // 配置超时和重试策略
    this.timeout = this.configService.get<number>('MOONSHOT_TIMEOUT') || 60000; // 默认60秒
    this.maxRetries =
      this.configService.get<number>('MOONSHOT_MAX_RETRIES') || 2; // 默认重试2次
    this.retryDelay =
      this.configService.get<number>('MOONSHOT_RETRY_DELAY') || 1000; // 默认延迟1秒

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL,
        maxRetries: 0, // 禁用 SDK 内置重试，使用自定义重试逻辑
      });
      this.logger.log(
        `Moonshot AI 客户端初始化成功 (timeout: ${this.timeout}ms, maxRetries: ${this.maxRetries})`,
      );
    } else {
      this.logger.warn('Moonshot API Key 未配置，字幕格式规整功能将不可用');
      this.client = null;
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}
