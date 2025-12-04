import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
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
   * 获取知识点详情
   * GET /api/knowledge-points/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getKnowledgePointById(
    @Param('id') id: string,
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

