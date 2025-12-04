import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  KnowledgePoint,
  KnowledgePointDocument,
} from '../schemas/knowledge-point.schema';
import {
  Segment,
  SegmentDocument,
} from '../../document/schemas/segment.schema';
import {
  Document,
  DocumentDocument,
} from '../../document/schemas/document.schema';
import { MoonshotService } from '../../../common/services/moonshot.service';

interface KnowledgeJobData {
  documentId: string;
  userId: string;
}

@Processor('knowledge-queue')
export class KnowledgeProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeProcessor.name);

  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    @InjectModel(Segment.name)
    private segmentModel: Model<SegmentDocument>,
    @InjectModel(KnowledgePoint.name)
    private knowledgePointModel: Model<KnowledgePointDocument>,
    private moonshotService: MoonshotService,
  ) {
    super();
  }

  async process(job: Job<KnowledgeJobData>) {
    const { documentId, userId } = job.data;

    this.logger.log(
      `开始处理知识点生成任务: jobId=${job.id}, documentId=${documentId}`,
    );

    try {
      // 更新进度
      await job.updateProgress({
        progress: 10,
        message: '正在获取文档信息...',
      });

      // 获取文档信息
      const document = await this.documentModel.findById(documentId);
      if (!document) {
        throw new Error(`文档不存在: ${documentId}`);
      }

      // 检查Moonshot服务是否可用
      if (!this.moonshotService.isAvailable()) {
        throw new Error('Moonshot 服务未配置，无法生成知识点');
      }

      await job.updateProgress({
        progress: 20,
        message: '正在获取文档片段...',
      });

      // 获取所有片段，按顺序排序
      const segments = await this.segmentModel
        .find({ documentId })
        .sort({ segmentIndex: 1 })
        .exec();

      if (!segments || segments.length === 0) {
        throw new Error('文档没有片段数据，无法生成知识点');
      }

      this.logger.log(`获取到 ${segments.length} 个片段`);

      await job.updateProgress({
        progress: 30,
        message: '正在构建内容文本...',
      });

      // 构建完整内容文本
      const contentText = segments.map((seg) => seg.text).join('\n');

      // 构建分段信息（用于定位）
      const segmentsForLLM = segments.map((seg) => ({
        text: seg.text,
        start: seg.startTime,
        end: seg.endTime,
        segmentId: seg._id.toString(),
      }));

      await job.updateProgress({
        progress: 40,
        message: '正在调用AI提炼知识点...',
      });

      // 调用Moonshot API提炼知识点
      this.logger.log('开始调用Moonshot API提炼知识点');
      const knowledgePoints = await this.moonshotService.extractKnowledgePoints(
        contentText,
        segmentsForLLM,
        {
          maxPoints: 8,
        },
      );

      this.logger.log(`AI提炼完成，共 ${knowledgePoints.length} 个知识点`);

      await job.updateProgress({
        progress: 70,
        message: '正在保存知识点...',
      });

      // 保存知识点到数据库
      const knowledgePointDocs = knowledgePoints.map((kp) => {
        // 查找对应的segment
        const segment = segments.find(
          (seg) => seg._id.toString() === kp.segmentId,
        );

        // 构建sourceAnchor
        const sourceAnchor: any = {
          type: document.sourceType,
        };

        if (document.sourceType === 'video') {
          sourceAnchor.startTime = segment?.startTime;
          sourceAnchor.endTime = segment?.endTime;
        } else if (document.sourceType === 'pdf') {
          sourceAnchor.page = segment?.pageNumber;
          sourceAnchor.startOffset = segment?.startOffset;
          sourceAnchor.endOffset = segment?.endOffset;
        } else if (document.sourceType === 'text') {
          sourceAnchor.startOffset = segment?.charStart;
          sourceAnchor.endOffset = segment?.charEnd;
        }

        if (segment) {
          sourceAnchor.segmentId = segment._id;
        }

        return {
          documentId,
          topic: kp.topic,
          excerpt: kp.excerpt,
          confidenceScore: kp.confidenceScore,
          displayOrder: kp.displayOrder,
          sourceAnchor,
        };
      });

      await this.knowledgePointModel.insertMany(knowledgePointDocs);

      this.logger.log(`保存了 ${knowledgePointDocs.length} 个知识点到数据库`);

      await job.updateProgress({ progress: 100, message: '知识点生成完成' });

      this.logger.log(
        `知识点生成任务完成: jobId=${job.id}, documentId=${documentId}`,
      );

      return {
        success: true,
        documentId,
        knowledgePointCount: knowledgePointDocs.length,
      };
    } catch (error) {
      this.logger.error(
        `知识点生成任务失败: jobId=${job.id}, documentId=${documentId}`,
        error,
      );

      // 重新抛出错误，让 BullMQ 处理重试
      throw error;
    }
  }
}
