import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  KnowledgePoint,
  KnowledgePointDocument,
} from './schemas/knowledge-point.schema';

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectQueue('knowledge-queue')
    private knowledgeQueue: Queue,
    @InjectModel(KnowledgePoint.name)
    private knowledgePointModel: Model<KnowledgePointDocument>,
  ) {}

  /**
   * 提交知识点生成任务
   */
  async generateKnowledgePoints(
    documentId: string,
    userId: string,
  ): Promise<{ jobId: string }> {
    const job = await this.knowledgeQueue.add('generate-knowledge-points', {
      documentId,
      userId,
    });

    return { jobId: job.id! };
  }

  /**
   * 获取文档的知识点列表
   * PDF 类型按页码和偏移量排序，其他类型按 displayOrder 排序
   */
  async getKnowledgePointsByDocumentId(
    documentId: string,
  ): Promise<KnowledgePointDocument[]> {
    const knowledgePoints = await this.knowledgePointModel
      .find({ documentId })
      .exec();

    // 如果没有数据，直接返回
    if (knowledgePoints.length === 0) {
      return knowledgePoints;
    }

    // 检查第一个知识点的类型
    const firstKp = knowledgePoints[0];
    const isPdf = firstKp.sourceAnchor?.type === 'pdf';

    if (isPdf) {
      // PDF 类型：按页码和偏移量排序
      return knowledgePoints.sort((a, b) => {
        const pageA = a.sourceAnchor?.page || 0;
        const pageB = b.sourceAnchor?.page || 0;
        if (pageA !== pageB) {
          return pageA - pageB;
        }
        // 页码相同，按 startOffset 排序
        const offsetA = a.sourceAnchor?.startOffset || 0;
        const offsetB = b.sourceAnchor?.startOffset || 0;
        return offsetA - offsetB;
      });
    } else {
      // 其他类型：按 displayOrder 排序
      return knowledgePoints.sort((a, b) => {
        const orderA = a.displayOrder || 0;
        const orderB = b.displayOrder || 0;
        return orderA - orderB;
      });
    }
  }

  /**
   * 获取知识点详情
   */
  async getKnowledgePointById(
    knowledgePointId: string,
  ): Promise<KnowledgePointDocument | null> {
    return this.knowledgePointModel.findById(knowledgePointId).exec();
  }
}
