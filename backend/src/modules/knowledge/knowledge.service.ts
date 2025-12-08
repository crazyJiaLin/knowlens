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
   */
  async getKnowledgePointsByDocumentId(
    documentId: string,
  ): Promise<KnowledgePointDocument[]> {
    return this.knowledgePointModel
      .find({ documentId })
      .sort({ displayOrder: 1 })
      .exec();
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

