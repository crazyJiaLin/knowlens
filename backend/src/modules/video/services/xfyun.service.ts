import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { XfyunAudioExtractorService } from './xfyun-audio-extractor.service';
import { XfyunSignatureUtil } from './utils/xfyun-signature.util';
import {
  XfyunTranscriptParser,
  TranscriptSegment,
} from './utils/xfyun-transcript-parser.util';
import { AudioDurationUtil } from './utils/audio-duration.util';

export type { TranscriptSegment };

@Injectable()
export class XfyunService {
  private readonly logger = new Logger(XfyunService.name);
  private readonly appId: string;
  private readonly accessKeyId: string;
  private readonly secretKey: string;
  private readonly transcriptParser: XfyunTranscriptParser;

  constructor(
    private configService: ConfigService,
    private audioExtractor: XfyunAudioExtractorService,
  ) {
    this.appId = this.configService.get<string>('XFYUN_APP_ID') || '';
    this.accessKeyId = this.configService.get<string>('XFYUN_API_KEY') || '';
    this.secretKey = this.configService.get<string>('XFYUN_SECRET_KEY') || '';

    this.transcriptParser = new XfyunTranscriptParser();

    if (!this.appId || !this.accessKeyId || !this.secretKey) {
      this.logger.warn(
        '科大讯飞配置不完整，语音识别功能将不可用。请配置 XFYUN_APP_ID、XFYUN_API_KEY 和 XFYUN_SECRET_KEY',
      );
    } else {
      this.logger.log(
        `科大讯飞配置已加载: APP_ID=${this.appId.substring(0, 4)}***`,
      );
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return !!(this.appId && this.accessKeyId && this.secretKey);
  }

  /**
   * 从视频链接提取音频
   */
  async extractAudio(videoUrl: string): Promise<string> {
    return this.audioExtractor.extractAudio(videoUrl);
  }

  /**
   * 调用科大讯飞录音文件转写 API
   */
  async transcribe(
    audioPath: string,
  ): Promise<Array<{ text: string; start: number; end: number }>> {
    if (!this.isAvailable()) {
      throw new Error('科大讯飞服务未配置，无法进行语音转写');
    }

    this.logger.log(`开始转写音频: ${audioPath}`);

    try {
      // 1. 上传音频文件
      const { orderId, taskEstimateTime } = await this.uploadAudio(audioPath);

      // 2. 轮询获取转写结果（根据预计处理时间优化轮询策略）
      const result = await this.pollTranscriptResult(orderId, taskEstimateTime);

      // 3. 解析结果
      return this.transcriptParser.parse(result);
    } catch (error) {
      this.logger.error(`音频转写失败: ${error}`);
      throw new Error(
        `音频转写失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 上传音频文件到科大讯飞（大模型 API）
   * 根据官方文档：https://www.xfyun.cn/doc/spark/asr_llm/Ifasr_llm.html
   */
  private async uploadAudio(audioPath: string): Promise<{
    orderId: string;
    taskEstimateTime: number;
  }> {
    // 获取文件信息
    const stats = fs.statSync(audioPath);
    const fileSize = stats.size;
    const fileName = path.basename(audioPath);

    // 读取音频文件
    const audioBuffer = fs.readFileSync(audioPath);

    // 获取音频时长（毫秒）
    const duration = await AudioDurationUtil.getDuration(audioPath);

    // 生成必填参数
    const dateTime = XfyunSignatureUtil.generateDateTime();
    const signatureRandom = XfyunSignatureUtil.generateSignatureRandom();

    // 构建查询参数（需要包含所有参数用于签名）
    const queryParams: Record<string, string> = {
      appId: this.appId,
      accessKeyId: this.accessKeyId,
      dateTime,
      signatureRandom,
      fileSize: fileSize.toString(),
      fileName,
      language: 'autodialect',
      duration,
    };

    // 生成签名
    const signature = XfyunSignatureUtil.generateSignature(
      queryParams,
      this.secretKey,
    );

    // 构建查询参数字符串（signature 不放在 URL 参数中，而是放在请求头中）
    const params = new URLSearchParams(queryParams);
    const urlWithParams = `https://office-api-ist-dx.iflyaisol.com/v2/upload?${params.toString()}`;

    this.logger.log(
      `签名已生成: ${signature ? signature.substring(0, 10) + '...' : '空'}`,
    );
    this.logger.log(`签名长度: ${signature ? signature.length : 0}`);
    this.logger.log(`上传请求 URL: ${urlWithParams}`);
    this.logger.log(
      `上传参数: appId=${this.appId}, accessKeyId=${this.accessKeyId.substring(0, 4)}***, fileSize=${fileSize}, fileName=${fileName}, language=autodialect, duration=${duration}ms`,
    );

    try {
      // 根据官方文档，signature 通过请求头传递
      const response = await axios.post(urlWithParams, audioBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          signature: signature,
        },
      });

      this.logger.debug(
        '科大讯飞上传音频文件响应: ' + JSON.stringify(response.data),
      );

      const data = response.data as {
        code?: string | number;
        descInfo?: string;
        message?: string;
        content?: {
          orderId?: string;
          taskEstimateTime?: number;
        };
        data?: {
          taskId?: string;
          orderId?: string;
        };
      };

      // 检查响应格式
      const isSuccess = data.code === '000000' || data.descInfo === 'success';

      if (isSuccess) {
        const orderId =
          (data.content && data.content.orderId) ||
          (data.data && data.data.orderId) ||
          '';
        if (orderId) {
          const estimateTime =
            data.content && 'taskEstimateTime' in data.content
              ? (data.content.taskEstimateTime as number)
              : 0;
          const estimateTimeStr = estimateTime ? `${estimateTime}` : '未知';
          this.logger.log(
            `上传成功，订单ID: ${orderId}, 预计处理时间: ${estimateTimeStr}ms`,
          );
          return {
            orderId,
            taskEstimateTime: estimateTime,
          };
        }
        throw new Error('科大讯飞上传成功，但未返回订单ID');
      } else {
        const errorMsg =
          data.descInfo || data.message || `错误代码: ${data.code}`;
        throw new Error(`科大讯飞上传失败: ${errorMsg}`);
      }
    } catch (error) {
      this.logger.error(`上传音频文件失败: ${error}`);
      if (axios.isAxiosError(error) && error.response) {
        const errorData = error.response.data as {
          code?: number;
          message?: string;
        };
        throw new Error(
          `上传失败: ${errorData.message || `错误代码: ${errorData.code || error.response.status}`}`,
        );
      }
      throw new Error(
        `上传失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 轮询获取转写结果（大模型 API）
   * 根据官方文档：https://www.xfyun.cn/doc/spark/asr_llm/Ifasr_llm.html
   */
  private async pollTranscriptResult(
    orderId: string,
    taskEstimateTime: number,
  ): Promise<unknown> {
    // 根据预计处理时间优化轮询策略
    const maxWaitTime =
      taskEstimateTime > 0 ? Math.ceil(taskEstimateTime * 1.5) : 300000; // 默认5分钟

    const pollInterval =
      taskEstimateTime > 0
        ? Math.min(Math.max(Math.ceil(taskEstimateTime / 20), 3000), 10000) // 3-10秒之间
        : 5000; // 默认5秒

    const maxAttempts = Math.ceil(maxWaitTime / pollInterval);
    let attempts = 0;
    const startTime = Date.now();

    this.logger.log(
      `开始轮询转写结果，订单ID: ${orderId}, 预计处理时间: ${taskEstimateTime}ms, 轮询间隔: ${pollInterval}ms, 最大等待时间: ${maxWaitTime}ms`,
    );

    while (attempts < maxAttempts) {
      // 等待轮询间隔
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      // 生成必填参数
      const dateTime = XfyunSignatureUtil.generateDateTime();
      const signatureRandom = XfyunSignatureUtil.generateSignatureRandom();

      // 构建查询参数
      const queryParams: Record<string, string> = {
        appId: this.appId,
        accessKeyId: this.accessKeyId,
        dateTime,
        signatureRandom,
        orderId,
      };

      // 生成签名
      const signature = XfyunSignatureUtil.generateSignature(
        queryParams,
        this.secretKey,
      );

      // 构建查询参数字符串
      const params = new URLSearchParams(queryParams);

      try {
        const response = await axios.get(
          `https://office-api-ist-dx.iflyaisol.com/v2/getResult?${params.toString()}`,
          {
            headers: {
              'Content-Type': 'application/json',
              signature: signature,
            },
          },
        );

        this.logger.debug(`查询转写结果响应: ${JSON.stringify(response.data)}`);

        const data = response.data as {
          code?: string | number;
          descInfo?: string;
          message?: string;
          content?: {
            orderInfo?: {
              orderId?: string;
              status?: number;
              failType?: number;
            };
            orderResult?: string;
            taskEstimateTime?: number;
            status?: number;
            [key: string]: unknown;
          };
          data?: {
            status?: number;
            [key: string]: unknown;
          };
        };

        // 检查响应格式
        const isSuccess =
          data.code === '000000' ||
          data.code === 0 ||
          data.code === '0' ||
          data.descInfo === 'success';

        if (isSuccess) {
          const result = data.content || data.data;
          if (result) {
            const status =
              (data.content?.orderInfo?.status as number) ||
              (result.status as number);

            /**
             * 0：订单已创建
             * 3：订单处理中
             * 4：订单已完成
             * -1：订单失败
             */
            if (status === 4) {
              // 转写完成
              const elapsedTime = Date.now() - startTime;
              this.logger.log(
                `转写完成，订单ID: ${orderId}, 耗时: ${elapsedTime}ms`,
              );
              return result;
            } else if (status === 3 || status === 0) {
              // 处理中，继续等待
              this.logger.debug(
                `转写处理中，订单ID: ${orderId}, 状态: ${status}, 已等待: ${Date.now() - startTime}ms`,
              );
            } else {
              const failType = data.content?.orderInfo?.failType;

              // 根据 failType 生成详细的错误信息
              let failMsg = `转写失败，状态码: ${status}`;
              if (failType !== undefined) {
                const failTypeMessages: Record<number, string> = {
                  0: '音频正常执行',
                  1: '音频上传失败',
                  2: '音频转码失败',
                  3: '音频识别失败',
                  4: '音频时长超限（最大音频时长为5小时）',
                  5: '音频校验失败（duration对应的值与真实音频时长不符合要求）',
                  6: '静音文件',
                  7: '翻译失败',
                  8: '账号无翻译权限',
                  9: '转写质检失败',
                  10: '转写质检未匹配出关键词',
                  11: 'upload接口创建任务时，未开启质检或者翻译能力',
                  12: '音频语种分析失败',
                  99: '其他错误',
                };

                const failTypeMsg =
                  failTypeMessages[failType] || `未知错误类型: ${failType}`;
                failMsg = `转写失败，失败类型 ${failType}: ${failTypeMsg}`;
              }

              throw new Error(
                `${failMsg}, 订单ID: ${orderId}, ${data.descInfo || data.message || ''}`,
              );
            }
          }
        } else {
          throw new Error(
            `查询转写结果失败: ${data.descInfo || data.message || `错误代码: ${data.code}`}`,
          );
        }
      } catch (error) {
        // 如果是转写失败的错误，直接抛出
        if (error instanceof Error && error.message.includes('转写失败')) {
          throw error;
        }
        // 其他错误继续重试
        this.logger.warn(
          `轮询转写结果失败: ${error}, 订单ID: ${orderId}, 已尝试: ${attempts + 1}/${maxAttempts}`,
        );
      }

      attempts++;
    }

    const elapsedTime = Date.now() - startTime;
    throw new Error(
      `转写超时，订单ID: ${orderId}, 已等待: ${elapsedTime}ms, 预计处理时间: ${taskEstimateTime}ms`,
    );
  }

  /**
   * 清理临时音频文件
   */
  async cleanupAudio(audioPath: string): Promise<void> {
    await Promise.resolve(); // 保持 async 接口一致性
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        this.logger.log(`已清理临时文件: ${audioPath}`);
      }
    } catch (error) {
      this.logger.warn(
        `清理文件失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
