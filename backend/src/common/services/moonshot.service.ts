import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Moonshot AI 服务
 * 用于知识点提炼和洞察生成
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
      this.logger.warn('Moonshot API Key 未配置，知识点提炼功能将不可用');
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
   * 从内容中提炼知识点
   * - 从完整内容中提取3-8个核心知识点
   * - 每个知识点包含主题、原文摘录、位置信息
   * - 按重要性排序
   *
   * @param contentText 完整内容文本
   * @param segments 分段信息，格式: [{ text: string, start?: number, end?: number, segmentId?: string }]
   * @param options 可选参数
   * @returns 知识点数组
   */
  async extractKnowledgePoints(
    contentText: string,
    segments: Array<{
      text: string;
      start?: number;
      end?: number;
      segmentId?: string;
    }>,
    options?: {
      maxPoints?: number;
      userRole?: string;
      userGoal?: string;
    },
  ): Promise<
    Array<{
      topic: string;
      excerpt: string;
      segmentId?: string;
      startTime?: number;
      endTime?: number;
      confidenceScore: number;
      displayOrder: number;
    }>
  > {
    if (!this.client) {
      throw new Error('Moonshot 服务未配置，无法提炼知识点');
    }

    if (!contentText || contentText.trim().length === 0) {
      throw new Error('内容文本为空，无法提炼知识点');
    }

    const maxPoints = options?.maxPoints || 8;
    this.logger.log(
      `开始提炼知识点，内容长度: ${contentText.length} 字符，最大知识点数: ${maxPoints}`,
    );

    // 构建分段信息文本，用于定位
    // 格式：segmentId: [时间段] 文本内容
    const segmentsText = segments
      .map((seg, index) => {
        const segmentId = seg.segmentId || `segment_${index}`;
        const timeInfo =
          seg.start !== undefined && seg.end !== undefined
            ? `[${seg.start.toFixed(2)}s-${seg.end.toFixed(2)}s]`
            : `[片段${index + 1}]`;
        return `segmentId: ${segmentId} ${timeInfo} ${seg.text}`;
      })
      .join('\n');

    // 构建 System Prompt
    const systemPrompt = `你是一个知识提炼专家，擅长从视频、文档等内容中提炼核心知识点。

你的任务是：
1. 识别内容中的核心观点、重要信息、关键概念
2. 为每个知识点提取主题和原文摘录
3. 标注知识点在原文中的位置
4. 按重要性排序知识点

要求：
- 知识点应该是独立的、有价值的观点或信息
- excerpt需尽量使用原文，长度控制在50-150字
- 知识点数量控制在3-${maxPoints}个之间`;

    // 构建 User Prompt
    let userPrompt = `请从以下内容中提炼出3-${maxPoints}个核心知识点。

要求：
1. 每个知识点需包含：topic（主题）、excerpt（原文摘录或轻度改写）
2. excerpt需尽量使用原文，长度控制在50-150字
3. 为每个excerpt标注它在原文中的位置：
   - segmentId：必须使用分段信息中提供的 segmentId（格式：segmentId: xxx）
   - startTime：该知识点在原文中的起始时间（秒），如果分段信息中有时间段则使用对应的时间
   - endTime：该知识点在原文中的结束时间（秒），如果分段信息中有时间段则使用对应的时间
4. 按重要性排序
5. 知识点应该是独立的、有价值的观点或信息`;

    if (options?.userRole || options?.userGoal) {
      userPrompt += '\n\n用户信息：';
      if (options.userRole) {
        userPrompt += `\n- 角色：${options.userRole}`;
      }
      if (options.userGoal) {
        userPrompt += `\n- 目标：${options.userGoal}`;
      }
      userPrompt += '\n请根据用户信息，提炼更符合其需求的知识点。';
    }

    userPrompt += `\n\n内容：
${contentText}

分段信息（用于定位）：
${segmentsText}

请以JSON格式输出：
{
  "knowledgePoints": [
    {
      "topic": "知识点主题",
      "excerpt": "原文摘录",
      "segmentId": "分段信息中提供的segmentId（必须准确匹配）",
      "startTime": 0.20,
      "endTime": 16.29,
      "confidenceScore": 0.95,
      "displayOrder": 1
    }
  ]
}

重要提示：
- segmentId 必须从分段信息中准确复制，不能自己生成或使用时间段字符串
- startTime 和 endTime 使用数字（秒），不是字符串
- 如果分段信息中没有时间段，startTime 和 endTime 可以为 null`;

    // 重试逻辑
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(
            `第 ${attempt} 次重试知识点提炼（共 ${this.maxRetries} 次）`,
          );
          await this.sleep(this.retryDelay * attempt); // 指数退避
        }

        const result = await this.extractKnowledgePointsWithRetry(
          systemPrompt,
          userPrompt,
        );
        this.logger.log(`知识点提炼完成，共 ${result.length} 个知识点`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `知识点提炼失败（尝试 ${attempt + 1}/${this.maxRetries + 1}）: ${lastError.message}`,
        );

        if (attempt >= this.maxRetries) {
          break;
        }
      }
    }

    throw new Error(
      `知识点提炼失败，已重试 ${this.maxRetries} 次: ${lastError?.message}`,
    );
  }

  /**
   * 执行知识点提炼（单次尝试）
   */
  private async extractKnowledgePointsWithRetry(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<
    Array<{
      topic: string;
      excerpt: string;
      segmentId?: string;
      startTime?: number;
      endTime?: number;
      confidenceScore: number;
      displayOrder: number;
    }>
  > {
    if (!this.client) {
      throw new Error('Moonshot 客户端未初始化');
    }

    const model =
      this.configService.get<string>('MOONSHOT_MODEL') || 'moonshot-v1-8k';

    // 创建带超时的请求
    const requestPromise = this.client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.3, // 较低温度，保证输出稳定性
      response_format: { type: 'json_object' },
    });

    // 使用 Promise.race 实现超时控制
    const timeoutPromise = this.createTimeoutPromise(this.timeout);
    const response = await Promise.race([
      requestPromise,
      timeoutPromise.then(() => {
        throw new Error(`请求超时（${this.timeout}ms）`);
      }),
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Moonshot API 返回空内容');
    }

    // 打印 LLM 模型调用返回的原始结果
    this.logger.log('=== Moonshot API 返回结果（知识点提炼）===');
    this.logger.log(`返回内容长度: ${content.length} 字符`);
    this.logger.debug(`返回内容: ${JSON.stringify(content)}`);
    this.logger.log('==========================================');

    // 解析 JSON 响应
    let result: {
      knowledgePoints?: Array<{
        topic: string;
        excerpt: string;
        segmentId?: string;
        startTime?: number | null;
        endTime?: number | null;
        confidenceScore?: number;
        displayOrder?: number;
      }>;
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result = JSON.parse(content);
    } catch (parseError) {
      this.logger.error(`JSON 解析失败: ${parseError}`);
      this.logger.debug(`返回内容: ${content.substring(0, 500)}`);
      throw new Error('Moonshot API 返回的 JSON 格式错误');
    }

    // 打印解析后的结果
    this.logger.log('=== 解析后的结果（知识点提炼）===');
    this.logger.log(`知识点数量: ${result.knowledgePoints?.length || 0}`);
    this.logger.debug(`解析结果: ${JSON.stringify(result, null, 2)}`);
    this.logger.log('==================================');

    if (!result.knowledgePoints || !Array.isArray(result.knowledgePoints)) {
      throw new Error(
        'Moonshot API 返回格式错误：缺少 knowledgePoints 字段或格式不正确',
      );
    }

    if (result.knowledgePoints.length === 0) {
      throw new Error('Moonshot API 返回空知识点数组');
    }

    // 验证并转换返回结果
    const knowledgePoints: Array<{
      topic: string;
      excerpt: string;
      segmentId?: string;
      startTime?: number;
      endTime?: number;
      confidenceScore: number;
      displayOrder: number;
    }> = [];

    for (let i = 0; i < result.knowledgePoints.length; i++) {
      const kp = result.knowledgePoints[i];
      if (!kp || !kp.topic || !kp.excerpt) {
        this.logger.warn(`跳过无效知识点 ${i}: ${JSON.stringify(kp)}`);
        continue;
      }

      // 处理时间信息
      const startTime =
        typeof kp.startTime === 'number' && kp.startTime >= 0
          ? kp.startTime
          : undefined;
      const endTime =
        typeof kp.endTime === 'number' && kp.endTime >= 0
          ? kp.endTime
          : undefined;

      knowledgePoints.push({
        topic: kp.topic.trim(),
        excerpt: kp.excerpt.trim(),
        segmentId: kp.segmentId?.trim(),
        startTime,
        endTime,
        confidenceScore:
          typeof kp.confidenceScore === 'number' &&
          kp.confidenceScore >= 0 &&
          kp.confidenceScore <= 1
            ? kp.confidenceScore
            : 0.8, // 默认置信度
        displayOrder:
          typeof kp.displayOrder === 'number' && kp.displayOrder > 0
            ? kp.displayOrder
            : i + 1, // 默认顺序
      });
    }

    if (knowledgePoints.length === 0) {
      throw new Error('所有知识点验证失败，无法返回有效结果');
    }

    // 按 displayOrder 排序
    knowledgePoints.sort((a, b) => a.displayOrder - b.displayOrder);

    // 打印最终处理后的结果
    this.logger.log('=== 最终处理后的结果（知识点提炼）===');
    this.logger.log(`有效知识点数量: ${knowledgePoints.length}`);
    this.logger.log('======================================');

    return knowledgePoints;
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(timeout: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), timeout);
    });
  }

  /**
   * 生成知识点的深度洞察
   * - 基于知识点内容和完整原文生成三段式洞察
   * - 包含逻辑演绎、隐含信息、延伸思考
   * - 使用 assistant 消息缓存原文内容以减少 token 消耗
   *
   * @param topic 知识点主题
   * @param excerpt 知识点摘录
   * @param allSegmentsText 所有片段文本（完整原文）
   * @returns 洞察结果
   */
  async generateInsight(
    topic: string,
    excerpt: string,
    allSegmentsText: string,
  ): Promise<{
    logic: string;
    hiddenInfo: string;
    extensionOptional: string;
  }> {
    if (!this.client) {
      throw new Error('Moonshot 服务未配置，无法生成洞察');
    }

    if (!topic || !excerpt) {
      throw new Error('知识点主题和摘录不能为空');
    }

    this.logger.log(`开始生成洞察，主题: ${topic}`);

    // 构建 System Prompt
    const systemPrompt = `你是一个深度思考专家，擅长从知识点中挖掘深层逻辑、隐含信息和延伸思考。

你的任务是：
1. 分析知识点背后的逻辑、原因或趋势
2. 挖掘作者未直接说明但隐含的信息
3. 提出可以进一步探索的方向和相关议题

要求：
- 分析要深入，避免浅层复述
- 逻辑要清晰，有理有据
- 延伸要有启发性`;

    // 构建 User Prompt（只包含知识点和问题，原文通过 assistant 消息传递）
    const userPrompt = `请针对以下知识点生成洞察。

知识点：
${topic}
${excerpt}

请基于上述原文内容，生成：
1. logic：这个知识点背后的逻辑、原因或趋势（200字以内）
2. hiddenInfo：作者未直接说明但隐含的信息（150字以内）
3. extensionOptional：可以进一步探索的方向和相关议题（150字以内）

要求：
- 分析要深入，避免浅层复述
- 逻辑要清晰，有理有据
- 延伸要有启发性
- 需要结合完整的原文上下文进行分析

以JSON格式输出：
{
  "logic": "...",
  "hiddenInfo": "...",
  "extensionOptional": "..."
}`;

    // 重试逻辑
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.log(
            `第 ${attempt} 次重试洞察生成（共 ${this.maxRetries} 次）`,
          );
          await this.sleep(this.retryDelay * attempt);
        }

        const result = await this.generateInsightWithRetry(
          systemPrompt,
          userPrompt,
          allSegmentsText,
        );
        this.logger.log('洞察生成完成');
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `洞察生成失败（尝试 ${attempt + 1}/${this.maxRetries + 1}）: ${lastError.message}`,
        );

        if (attempt >= this.maxRetries) {
          break;
        }
      }
    }

    throw new Error(
      `洞察生成失败，已重试 ${this.maxRetries} 次: ${lastError?.message}`,
    );
  }

  /**
   * 流式生成洞察
   * @param topic 知识点主题
   * @param excerpt 知识点摘录
   * @param allSegmentsText 所有片段文本
   * @param onChunk 接收流式数据的回调函数
   */
  async generateInsightStream(
    topic: string,
    excerpt: string,
    allSegmentsText: string,
    onChunk: (chunk: {
      logic?: string;
      hiddenInfo?: string;
      extensionOptional?: string;
    }) => void,
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Moonshot 服务未配置，无法生成洞察');
    }

    if (!topic || !excerpt) {
      throw new Error('知识点主题和摘录不能为空');
    }

    this.logger.log(`开始流式生成洞察，主题: ${topic}`);

    // 构建 System Prompt
    const systemPrompt = `你是一个深度思考专家，擅长从知识点中挖掘深层逻辑、隐含信息和延伸思考。

你的任务是：
1. 分析知识点背后的逻辑、原因或趋势
2. 挖掘作者未直接说明但隐含的信息
3. 提出可以进一步探索的方向和相关议题

要求：
- 分析要深入，避免浅层复述
- 逻辑要清晰，有理有据
- 延伸要有启发性`;

    // 构建 User Prompt
    const userPrompt = `请针对以下知识点生成洞察。

知识点：
${topic}
${excerpt}

请基于上述原文内容，生成：
1. logic：这个知识点背后的逻辑、原因或趋势（200字以内）
2. hiddenInfo：作者未直接说明但隐含的信息（150字以内）
3. extensionOptional：可以进一步探索的方向和相关议题（150字以内）

要求：
- 分析要深入，避免浅层复述
- 逻辑要清晰，有理有据
- 延伸要有启发性
- 需要结合完整的原文上下文进行分析

以JSON格式输出：
{
  "logic": "...",
  "hiddenInfo": "...",
  "extensionOptional": "..."
}`;

    const model =
      this.configService.get<string>('MOONSHOT_MODEL') || 'moonshot-v1-8k';

    // 创建流式请求
    const stream = await this.client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'assistant',
          content: `以下是完整的原文内容，包含所有片段：

${allSegmentsText}

请基于这些原文内容回答用户的问题。`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      stream: true, // 启用流式输出
    });

    let buffer = '';
    const result: {
      logic: string;
      hiddenInfo: string;
      extensionOptional: string;
    } = {
      logic: '',
      hiddenInfo: '',
      extensionOptional: '',
    };

    // 处理流式数据
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        buffer += content;

        // 尝试解析 JSON（可能是不完整的）
        try {
          // 尝试找到完整的 JSON 对象
          const jsonMatch = buffer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            const parsed = JSON.parse(jsonStr) as {
              logic?: string;
              hiddenInfo?: string;
              extensionOptional?: string;
            };

            // 更新结果并发送增量更新
            if (parsed.logic && parsed.logic !== result.logic) {
              result.logic = parsed.logic;
              onChunk({ logic: parsed.logic });
            }
            if (parsed.hiddenInfo && parsed.hiddenInfo !== result.hiddenInfo) {
              result.hiddenInfo = parsed.hiddenInfo;
              onChunk({ hiddenInfo: parsed.hiddenInfo });
            }
            if (
              parsed.extensionOptional &&
              parsed.extensionOptional !== result.extensionOptional
            ) {
              result.extensionOptional = parsed.extensionOptional;
              onChunk({ extensionOptional: parsed.extensionOptional });
            }
          }
        } catch {
          // JSON 还不完整，继续等待
        }
      }
    }

    // 最终解析完整的 JSON
    try {
      const jsonMatch = buffer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr) as {
          logic?: string;
          hiddenInfo?: string;
          extensionOptional?: string;
        };
        result.logic = parsed.logic || result.logic;
        result.hiddenInfo = parsed.hiddenInfo || result.hiddenInfo;
        result.extensionOptional =
          parsed.extensionOptional || result.extensionOptional;
      }
    } catch (error) {
      this.logger.error('解析流式 JSON 失败:', error);
      throw new Error('解析洞察结果失败');
    }

    this.logger.log('流式洞察生成完成');
  }

  /**
   * 执行洞察生成（单次尝试）
   * 使用 assistant 消息缓存原文内容，减少 token 消耗
   */
  private async generateInsightWithRetry(
    systemPrompt: string,
    userPrompt: string,
    allSegmentsText: string,
  ): Promise<{
    logic: string;
    hiddenInfo: string;
    extensionOptional: string;
  }> {
    if (!this.client) {
      throw new Error('Moonshot 客户端未初始化');
    }

    const model =
      this.configService.get<string>('MOONSHOT_MODEL') || 'moonshot-v1-8k';

    const startTime = Date.now();

    // 创建带超时的请求
    // 使用 assistant 消息缓存原文内容，这样可以减少 token 消耗
    // 原文内容作为 assistant 消息，后续相同文档的请求可以复用
    const requestPromise = this.client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'assistant',
          content: `以下是完整的原文内容，包含所有片段：

${allSegmentsText}

请基于这些原文内容回答用户的问题。`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7, // 稍高温度，鼓励创造性思考
      response_format: { type: 'json_object' },
    });

    // 使用 Promise.race 实现超时控制
    const timeoutPromise = this.createTimeoutPromise(this.timeout);
    const response = await Promise.race([
      requestPromise,
      timeoutPromise.then(() => {
        throw new Error(`请求超时（${this.timeout}ms）`);
      }),
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Moonshot API 返回空内容');
    }

    const generationTimeMs = Date.now() - startTime;
    const tokensUsed =
      response.usage?.total_tokens || response.usage?.prompt_tokens || 0;

    // 打印 LLM 模型调用返回的原始结果
    this.logger.log('=== Moonshot API 返回结果（洞察生成）===');
    this.logger.log(
      `返回内容长度: ${content.length} 字符，生成耗时: ${generationTimeMs}ms ，Token使用: ${tokensUsed}， 返回内容: ${JSON.stringify(content)}`,
    );
    this.logger.log('==========================================');

    // 解析 JSON 响应
    let result: {
      logic?: string;
      hiddenInfo?: string;
      extensionOptional?: string;
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      result = JSON.parse(content);
    } catch (parseError) {
      this.logger.error(`JSON 解析失败: ${parseError}`);
      this.logger.debug(`返回内容: ${content.substring(0, 500)}`);
      throw new Error('Moonshot API 返回的 JSON 格式错误');
    }

    // 验证返回结果
    if (!result.logic) {
      throw new Error('Moonshot API 返回格式错误：缺少 logic 字段');
    }

    // 打印解析后的结果
    this.logger.log('=== 解析后的结果（洞察生成）===');
    this.logger.debug(`解析结果: ${JSON.stringify(result, null, 2)}`);
    this.logger.log('==================================');

    return {
      logic: result.logic.trim(),
      hiddenInfo: result.hiddenInfo?.trim() || '',
      extensionOptional: result.extensionOptional?.trim() || '',
    };
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
