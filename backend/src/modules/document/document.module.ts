import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { Document, DocumentSchema } from './schemas/document.schema';
import { Segment, SegmentSchema } from './schemas/segment.schema';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import {
  KnowledgePoint,
  KnowledgePointSchema,
} from '../knowledge/schemas/knowledge-point.schema';
import { Insight, InsightSchema } from '../insight/schemas/insight.schema';
import { AliyunModule } from '../aliyun/aliyun.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Segment.name, schema: SegmentSchema },
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
      { name: Insight.name, schema: InsightSchema },
    ]),
    CommonModule,
    BullModule.registerQueue({
      name: 'video-queue',
      defaultJobOptions: {
        // 已完成任务保留 7 天
        removeOnComplete: {
          age: 7 * 24 * 60 * 60 * 1000, // 7 天（毫秒）
          count: 1000, // 或保留最近 1000 条（取较小值）
        },
        // 失败任务保留 30 天
        removeOnFail: {
          age: 30 * 24 * 60 * 60 * 1000, // 30 天（毫秒）
          count: 500, // 或保留最近 500 条（取较小值）
        },
      },
    }),
    BullModule.registerQueue({
      name: 'knowledge-queue',
      defaultJobOptions: {
        // 已完成任务保留 7 天
        removeOnComplete: {
          age: 7 * 24 * 60 * 60 * 1000, // 7 天（毫秒）
          count: 1000, // 或保留最近 1000 条（取较小值）
        },
        // 失败任务保留 30 天
        removeOnFail: {
          age: 30 * 24 * 60 * 60 * 1000, // 30 天（毫秒）
          count: 500, // 或保留最近 500 条（取较小值）
        },
      },
    }),
    AliyunModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService, MongooseModule],
})
export class DocumentModule {}
