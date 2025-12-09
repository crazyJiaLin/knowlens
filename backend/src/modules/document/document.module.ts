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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Segment.name, schema: SegmentSchema },
      { name: KnowledgePoint.name, schema: KnowledgePointSchema },
      { name: Insight.name, schema: InsightSchema },
    ]),
    BullModule.registerQueue({
      name: 'video-queue',
    }),
    AliyunModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService, MongooseModule],
})
export class DocumentModule {}
