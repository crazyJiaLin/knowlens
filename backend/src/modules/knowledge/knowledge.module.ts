import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import {
  KnowledgePoint,
  KnowledgePointSchema,
} from './schemas/knowledge-point.schema';
import { Segment, SegmentSchema } from '../document/schemas/segment.schema';
import { Document, DocumentSchema } from '../document/schemas/document.schema';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeProcessor } from './processors/knowledge.processor';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
      { name: Segment.name, schema: SegmentSchema },
      { name: Document.name, schema: DocumentSchema },
    ]),
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
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeProcessor],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
