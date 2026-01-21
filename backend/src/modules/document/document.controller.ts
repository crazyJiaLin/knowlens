import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DocumentService } from './document.service';
import { QueryDocumentDto } from './dto/query-document.dto';
import { CreateFromTextDto } from './dto/create-from-text.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators/user.decorator';

@ApiTags('文档')
@Controller('document')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    @InjectQueue('video-queue') private videoQueue: Queue,
    @InjectQueue('pdf-queue') private pdfQueue: Queue,
    @InjectQueue('knowledge-queue') private knowledgeQueue: Queue,
  ) {}

  @Get('list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取文档列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  async getDocumentList(
    @User('id') userId: string,
    @Query() queryDto: QueryDocumentDto,
  ) {
    return this.documentService.findList(userId, queryDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取文档详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async getDocumentById(
    @Param('id') documentId: string,
    @User('id') userId: string,
  ) {
    return this.documentService.findById(documentId, userId);
  }

  @Get(':id/segments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取文档片段列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async getDocumentSegments(
    @Param('id') documentId: string,
    @User('id') userId: string,
  ) {
    return this.documentService.findSegments(documentId, userId);
  }

  @Get(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取文档处理状态（用于轮询）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async getDocumentStatus(
    @Param('id') documentId: string,
    @User('id') userId: string,
  ) {
    const status = await this.documentService.getStatus(documentId, userId);

    // 如果文档正在处理中，尝试从队列获取进度
    if (status.status === 'processing') {
      try {
        // 先查找 video-queue 中的任务
        const videoJobs = await this.videoQueue.getJobs(['active', 'waiting']);
        let job = videoJobs.find(
          (j) =>
            j.data &&
            (j.data as { documentId?: string }).documentId === documentId,
        );

        // 如果没找到，再查找 pdf-queue 中的任务
        if (!job) {
          const pdfJobs = await this.pdfQueue.getJobs(['active', 'waiting']);
          job = pdfJobs.find(
            (j) =>
              j.data &&
              (j.data as { documentId?: string }).documentId === documentId,
          );
        }

        // 如果没找到，再查找 knowledge-queue 中的任务
        if (!job) {
          const knowledgeJobs = await this.knowledgeQueue.getJobs([
            'active',
            'waiting',
          ]);
          job = knowledgeJobs.find(
            (j) =>
              j.data &&
              (j.data as { documentId?: string }).documentId === documentId,
          );
        }

        if (job) {
          // BullMQ job.progress 可能是属性或 getter，需要 await
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const jobProgress = (job as any).progress;
            // 如果 progress 是 Promise，需要 await
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const progressValue =
              jobProgress instanceof Promise ? await jobProgress : jobProgress;

            // progressValue 可能是数字或对象 { progress: number, message?: string }
            if (typeof progressValue === 'number') {
              return {
                ...status,
                progress: Math.min(100, Math.max(0, progressValue)),
              };
            } else if (
              typeof progressValue === 'object' &&
              progressValue !== null &&
              'progress' in progressValue
            ) {
              const progressObj = progressValue as {
                progress: number;
                message?: string;
              };
              return {
                ...status,
                progress: Math.min(100, Math.max(0, progressObj.progress)),
                message: progressObj.message,
              };
            }
          } catch (progressError) {
            // 获取进度失败，继续返回状态
            console.warn('获取任务进度失败:', progressError);
          }
        }
      } catch (error) {
        // 获取进度失败不影响状态返回
        console.warn('获取任务进度失败:', error);
      }
    }

    return status;
  }

  @Post('create-from-text')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '从文本创建文档' })
  @ApiResponse({ status: 200, description: '创建成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 400, description: '参数错误' })
  async createFromText(
    @Body() dto: CreateFromTextDto,
    @User('id') userId: string,
  ) {
    const result = await this.documentService.createFromText(dto, userId);
    return {
      success: true,
      ...result,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除文档' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async deleteDocument(
    @Param('id') documentId: string,
    @User('id') userId: string,
  ) {
    await this.documentService.deleteDocument(documentId, userId);
    return {
      success: true,
      message: '文档删除成功',
    };
  }
}
