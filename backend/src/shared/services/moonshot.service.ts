import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class MoonshotService {
  private readonly logger = new Logger(MoonshotService.name);
  private readonly client: OpenAI | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('MOONSHOT_API_KEY');
    const baseURL =
      this.configService.get<string>('MOONSHOT_BASE_URL') ||
      'https://api.moonshot.cn/v1';

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL,
      });
      this.logger.log('Moonshot AI 客户端初始化成功');
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

  /**
   * 使用大语言模型对字幕进行格式规整
   * - 分段优化：将过短或过长的片段进行合理分段
   * - 错别字纠正：纠正明显的错别字和语法错误
   * - 重要：保证原文内容不变，只进行格式优化
   *
   * @param transcript 原始字幕数组，格式: [{ text: string, start: number, end: number }]
   * @returns 规整后的字幕数组，保持相同格式
   */
  async formatTranscript(
    transcript: Array<{ text: string; start: number; end: number }>,
  ): Promise<Array<{ text: string; start: number; end: number }>> {
    if (!this.client) {
      this.logger.warn('Moonshot 服务未配置，返回原始字幕');
      return transcript;
    }

    this.logger.log(`开始规整字幕格式，共 ${transcript.length} 条`);

    try {
      // 将字幕合并为文本，保留时间戳信息
      const transcriptText = transcript
        .map(
          (item, index) =>
            `[${index}] ${item.start}s-${item.end}s: ${item.text}`,
        )
        .join('\n');

      const prompt = `你是一个专业的字幕格式规整助手。请对以下字幕进行格式优化，要求：

1. **分段优化**：将过短（少于10字）或过长（超过200字）的片段进行合理分段或合并
2. **错别字纠正**：纠正明显的错别字和语法错误
3. **重要约束**：必须保证原文内容不变，不能添加、删除或改变原意，只能进行格式优化和错别字纠正
4. **时间戳保持**：保持原有的时间戳信息，格式为 [索引] 开始时间s-结束时间s: 文本内容

请以JSON格式返回结果，格式如下：
{
  "segments": [
    {
      "index": 0,
      "text": "规整后的文本",
      "start": 0.0,
      "end": 5.0
    }
  ]
}

原始字幕：
${transcriptText}`;

      const model =
        this.configService.get<string>('MOONSHOT_MODEL') || 'moonshot-v1-k2';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的字幕格式规整助手，擅长优化字幕格式和纠正错别字，同时严格保证原文内容不变。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // 较低温度，保证输出稳定性
        response_format: { type: 'json_object' },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Moonshot API 返回空内容');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = JSON.parse(content as string) as {
        segments?: Array<{
          index?: number;
          text: string;
          start: number;
          end: number;
        }>;
      };

      if (!result.segments || !Array.isArray(result.segments)) {
        throw new Error('Moonshot API 返回格式错误');
      }

      // 验证返回结果并转换为标准格式
      const formattedSegments = result.segments.map((seg) => ({
        text: seg.text,
        start: seg.start,
        end: seg.end,
      }));

      this.logger.log(`字幕规整完成，共 ${formattedSegments.length} 条`);
      return formattedSegments;
    } catch (error) {
      this.logger.error(
        `字幕规整失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      // 如果规整失败，返回原始字幕，不影响后续流程
      this.logger.warn('返回原始字幕，跳过格式规整');
      return transcript;
    }
  }
}
