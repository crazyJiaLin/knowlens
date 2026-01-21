import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InsightService } from './insight.service';
import { GenerateInsightDto } from './dto/generate-insight.dto';

@Controller('insight')
@UseGuards(JwtAuthGuard)
export class InsightController {
  constructor(private readonly insightService: InsightService) {}

  /**
   * 生成或获取知识点的洞察
   * POST /api/insight/generate
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateInsight(@Body() dto: GenerateInsightDto) {
    const { kp_id, force_regenerate = false } = dto;

    if (!kp_id) {
      throw new BadRequestException('kp_id 参数必填');
    }

    const insight = await this.insightService.generateOrGetInsight(
      kp_id,
      force_regenerate,
    );

    return {
      success: true,
      data: {
        logic: insight.logic,
        hiddenInfo: insight.hiddenInfo,
        extensionOptional: insight.extensionOptional,
        tokensUsed: insight.tokensUsed,
        generationTimeMs: insight.generationTimeMs,
      },
    };
  }

  /**
   * 获取知识点的洞察（不生成）
   * GET /api/insight/:kpId
   */
  @Get(':kpId')
  @HttpCode(HttpStatus.OK)
  async getInsight(@Param('kpId') kpId: string) {
    if (!kpId) {
      throw new BadRequestException('kpId 参数必填');
    }

    const insight =
      await this.insightService.getInsightByKnowledgePointId(kpId);

    if (!insight) {
      throw new NotFoundException('洞察不存在');
    }

    return {
      success: true,
      data: {
        logic: insight.logic,
        hiddenInfo: insight.hiddenInfo,
        extensionOptional: insight.extensionOptional,
        tokensUsed: insight.tokensUsed,
        generationTimeMs: insight.generationTimeMs,
      },
    };
  }

  /**
   * 生成或获取知识点的洞察（流式输出）
   * POST /api/insight/generate-stream
   */
  @Post('generate-stream')
  async generateInsightStream(
    @Body() dto: GenerateInsightDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { kp_id, force_regenerate = false } = dto;

    if (!kp_id) {
      throw new BadRequestException('kp_id 参数必填');
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

    try {
      // 使用流式生成洞察
      await this.insightService.generateOrGetInsightStream(
        kp_id,
        force_regenerate,
        (chunk) => {
          // 发送 SSE 数据
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        },
      );

      // 发送完成标记
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      // 发送错误信息
      const errorMessage =
        error instanceof Error ? error.message : String(error) || '生成失败';
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
}
