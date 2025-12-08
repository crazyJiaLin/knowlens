import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
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
      },
    };
  }
}
