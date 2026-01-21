import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
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
    const { documentId } = job.data;

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
        message: '正在调用AI生成标题和提炼知识点...',
      });

      // 如果文档标题是临时标题（"解析中..."），则使用AI生成标题
      let generatedTitle: string | null = null;
      if (
        document.title === '解析中...' ||
        !document.title ||
        document.title.trim() === ''
      ) {
        try {
          this.logger.log('开始使用AI生成文档标题...');
          generatedTitle =
            await this.moonshotService.generateTitle(contentText);
          this.logger.log(`AI生成标题成功: ${generatedTitle}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(`AI生成标题失败: ${errorMessage}，将使用默认标题`);
          // 如果AI生成失败，使用文本前50字符作为标题
          generatedTitle =
            contentText.substring(0, 50).replace(/\n/g, ' ').trim() ||
            '文本文档';
        }
      }

      await job.updateProgress({
        progress: 50,
        message: '正在调用AI提炼知识点...',
      });

      // 调用Moonshot API提炼知识点
      this.logger.log('开始调用Moonshot API提炼知识点');
      // 不指定 maxPoints，让服务根据内容长度自动计算
      const knowledgePoints = await this.moonshotService.extractKnowledgePoints(
        contentText,
        segmentsForLLM,
      );

      this.logger.log(`AI提炼完成，共 ${knowledgePoints.length} 个知识点`);

      await job.updateProgress({
        progress: 70,
        message: '正在保存知识点...',
      });

      // 删除该文档的旧知识点（重新生成时）
      await this.knowledgePointModel.deleteMany({ documentId });
      this.logger.log(`已删除文档 ${documentId} 的旧知识点`);

      // 保存知识点到数据库
      const knowledgePointDocs = knowledgePoints.map((kp) => {
        // 查找对应的segment
        // 优先通过 segmentId 匹配
        let segment = segments.find(
          (seg) => seg._id.toString() === kp.segmentId,
        );

        // 如果通过 segmentId 找不到，尝试通过时间段匹配（作为备选方案）
        if (
          !segment &&
          kp.startTime !== undefined &&
          kp.endTime !== undefined
        ) {
          segment = segments.find(
            (seg) =>
              seg.startTime !== undefined &&
              seg.endTime !== undefined &&
              Math.abs(seg.startTime - kp.startTime!) < 1 && // 允许1秒误差
              Math.abs(seg.endTime - kp.endTime!) < 1,
          );
        }

        // 构建sourceAnchor
        interface SourceAnchor {
          type: 'video' | 'pdf' | 'text';
          startTime?: number;
          endTime?: number;
          page?: number;
          startOffset?: number;
          endOffset?: number;
          segmentId?: string;
        }

        const sourceAnchor: SourceAnchor = {
          type: document.sourceType as 'video' | 'pdf' | 'text',
        };

        if (document.sourceType === 'video') {
          // 优先使用大模型返回的时间，如果没有则使用 segment 的时间
          sourceAnchor.startTime = kp.startTime ?? segment?.startTime;
          sourceAnchor.endTime = kp.endTime ?? segment?.endTime;
        } else if (document.sourceType === 'pdf') {
          sourceAnchor.page = segment?.pageNumber;
          sourceAnchor.startOffset = segment?.startOffset;
          sourceAnchor.endOffset = segment?.endOffset;
        } else if (document.sourceType === 'text') {
          sourceAnchor.startOffset = segment?.charStart;
          sourceAnchor.endOffset = segment?.charEnd;
        }

        if (segment) {
          sourceAnchor.segmentId = segment._id.toString();
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

      // 更新文档标题和状态
      const updateData: { title?: string; status: string } = {
        status: 'completed',
      };

      if (generatedTitle) {
        updateData.title = generatedTitle;
      }

      await this.documentModel.updateOne({ _id: documentId }, updateData);

      if (generatedTitle) {
        this.logger.log(`已更新文档标题: ${generatedTitle}`);
      }
      this.logger.log(`已更新文档状态为 completed`);

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

      // 如果已经是最后一次重试，更新文档状态为 failed
      if (job.attemptsMade >= (job.opts.attempts || 1)) {
        this.logger.error(
          `知识点生成任务已达到最大重试次数，将文档标记为失败: documentId=${documentId}`,
        );
        try {
          await this.documentModel.updateOne(
            { _id: documentId },
            {
              status: 'failed',
              errorMessage:
                error instanceof Error
                  ? `知识点生成失败: ${error.message}`
                  : '知识点生成失败',
            },
          );
        } catch (updateError) {
          this.logger.error(
            `更新文档失败状态失败: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
          );
        }
      }

      // 重新抛出错误，让 BullMQ 处理重试
      throw error;
    }
  }
}
