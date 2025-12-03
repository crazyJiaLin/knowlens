import {
  Controller,
  Get,
  Param,
  Query,
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
        // 查找相关的任务（通过 documentId 匹配）
        const jobs = await this.videoQueue.getJobs(['active', 'waiting']);
        const job = jobs.find(
          (j) =>
            j.data &&
            (j.data as { documentId?: string }).documentId === documentId,
        );

        if (job) {
          // BullMQ job.progress 可能是属性或 getter，需要 await
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const jobProgress = (job as any).progress;
            // 如果 progress 是 Promise，需要 await
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
}
