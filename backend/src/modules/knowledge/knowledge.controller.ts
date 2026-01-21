import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge-points')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  /**
   * 获取文档的知识点列表
   * GET /api/knowledge-points?documentId=xxx
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getKnowledgePoints(
    @Query('documentId') documentId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentUser('id') userId: string,
  ) {
    if (!documentId) {
      throw new Error('documentId 参数必填');
    }

    const knowledgePoints =
      await this.knowledgeService.getKnowledgePointsByDocumentId(documentId);

    return {
      success: true,
      data: knowledgePoints,
      count: knowledgePoints.length,
    };
  }

  /**
   * 重新生成文档的知识点
   * POST /api/knowledge-points/regenerate
   */
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateKnowledgePoints(
    @Body('documentId') documentId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!documentId) {
      throw new BadRequestException('documentId 参数必填');
    }

    const result = await this.knowledgeService.generateKnowledgePoints(
      documentId,
      userId,
    );

    return {
      success: true,
      message: '知识点重新生成任务已提交',
      data: result,
    };
  }

  /**
   * 获取知识点详情
   * GET /api/knowledge-points/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getKnowledgePointById(
    @Param('id') id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentUser('id') userId: string,
  ) {
    const knowledgePoint =
      await this.knowledgeService.getKnowledgePointById(id);

    if (!knowledgePoint) {
      throw new Error('知识点不存在');
    }

    return {
      success: true,
      data: knowledgePoint,
    };
  }
}
